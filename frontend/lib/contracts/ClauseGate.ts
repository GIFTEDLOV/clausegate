import { createClient } from "genlayer-js";
import { TransactionStatus, type TransactionHash } from "genlayer-js/types";

import { getEthereumProvider, getRpcUrl } from "@/lib/genlayer/client";
import { BRADBURY_CHAIN } from "@/lib/genlayer/network";
import { classify } from "@/lib/genlayer/classify";
import { recomputeResultDigest } from "@/lib/genlayer/digest";
import {
  clearTransaction,
  getPendingTransaction,
  markTransactionFailed,
  rememberTransaction,
} from "@/lib/transactions/journal";
import type { PendingExpected, PendingTransaction } from "@/lib/transactions/journal";
import type {
  ApprovalCertificate,
  ContractInfo,
  Rulebook,
  Submission,
  TransactionReceipt,
  WriteStage,
} from "./types";

function normalize(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries()).map(([key, item]) => [key, normalize(item)]));
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

/** The transaction is in flight; its outcome is not yet known. Never resend it. */
export class PendingWriteError extends Error {
  readonly hash: string;

  constructor(hash: string) {
    super("This transaction is still waiting for network confirmation.");
    this.name = "PendingWriteError";
    this.hash = hash;
  }
}

/** The transaction conclusively failed consensus or execution. Never resend it. */
export class WriteFailedError extends Error {
  readonly hash: string;

  constructor(hash: string, reason: string) {
    super(reason);
    this.name = "WriteFailedError";
    this.hash = hash;
  }
}

export interface WriteResult {
  hash: string | null;
  receipt: TransactionReceipt | null;
  alreadyFinalized?: boolean;
}

/** Resolves true once the intended on-chain state exists and matches. */
type Postcondition = () => Promise<boolean>;

export class ClauseGate {
  private readonly address: `0x${string}`;
  private readonly client: any;

  constructor(contractAddress: string, account?: string | null) {
    this.address = contractAddress as `0x${string}`;
    this.client = createClient({
      chain: BRADBURY_CHAIN,
      endpoint: getRpcUrl(),
      provider: getEthereumProvider() || undefined,
      ...(account ? { account: account as `0x${string}` } : {}),
    });
  }

  private async read(functionName: string, args: unknown[] = []) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const value = await this.client.readContract({
          address: this.address,
          functionName,
          args,
        });
        return normalize(value);
      } catch (error) {
        lastError = error;
        if (attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt)));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Network read failed");
  }

  async getRulebookIds(): Promise<string[]> {
    return (await this.read("get_rulebook_ids")) as string[];
  }

  async getSubmissionIds(): Promise<string[]> {
    return (await this.read("get_submission_ids")) as string[];
  }

  async getRulebook(id: string): Promise<Rulebook> {
    return (await this.read("get_rulebook", [id])) as Rulebook;
  }

  async getSubmission(id: string): Promise<Submission> {
    return (await this.read("get_submission", [id])) as Submission;
  }

  async getCertificate(id: string): Promise<ApprovalCertificate | null> {
    const result = (await this.read("get_certificate", [id])) as Record<string, unknown>;
    return Object.keys(result || {}).length ? (result as unknown as ApprovalCertificate) : null;
  }

  async getContractInfo(): Promise<ContractInfo> {
    return (await this.read("contract_info")) as ContractInfo;
  }

  async getRulebooks(): Promise<Rulebook[]> {
    const ids = await this.getRulebookIds();
    return Promise.all(ids.map((id) => this.getRulebook(id)));
  }

  async getSubmissions(): Promise<Submission[]> {
    const ids = await this.getSubmissionIds();
    return Promise.all(ids.map((id) => this.getSubmission(id)));
  }

  private rulebookPostcondition(expected: Extract<PendingExpected, { kind: "rulebook" }>): Postcondition {
    return async () => {
      try {
        const rb = await this.getRulebook(expected.id);
        const ids = await this.getRulebookIds();
        return (
          rb.rulebook_id === expected.id &&
          rb.title === expected.title &&
          rb.description === expected.description &&
          rb.rules === expected.rules &&
          rb.active === true &&
          ids.includes(expected.id)
        );
      } catch {
        return false;
      }
    };
  }

  private submissionPostcondition(expected: Extract<PendingExpected, { kind: "submission" }>): Postcondition {
    return async () => {
      try {
        const sub = await this.getSubmission(expected.id);
        const ids = await this.getSubmissionIds();
        return (
          sub.submission_id === expected.id &&
          sub.rulebook_id === expected.rulebookId &&
          sub.title === expected.title &&
          sub.proposal_text === expected.proposalText &&
          sub.status === "SUBMITTED" &&
          sub.verdict === "" &&
          sub.certificate_issued === false &&
          ids.includes(expected.id)
        );
      } catch {
        return false;
      }
    };
  }

  private reviewPostcondition(id: string): Postcondition {
    return async () => {
      try {
        const sub = await this.getSubmission(id);
        if (sub.status !== "REVIEWED") return false;
        if (!["COMPLIANT", "NON_COMPLIANT", "UNCLEAR"].includes(sub.verdict)) return false;
        const cert = await this.getCertificate(id);

        if (sub.verdict === "COMPLIANT") {
          if (!sub.certificate_issued || !sub.result_digest) return false;
          if (!cert || cert.verdict !== "COMPLIANT" || cert.result_digest !== sub.result_digest) return false;
          const rb = await this.getRulebook(sub.rulebook_id);
          const recomputed = await recomputeResultDigest(rb, sub, "COMPLIANT");
          return recomputed === sub.result_digest;
        }

        return sub.certificate_issued === false && sub.result_digest === "" && cert === null;
      } catch {
        return false;
      }
    };
  }

  /** Reconcile a persisted browser entry with its exact method postcondition. */
  async reconcilePending(entry: PendingTransaction, onStage?: (stage: WriteStage) => void) {
    let postcondition: Postcondition | null = null;
    if (entry.action === "create-rulebook" && entry.expected?.kind === "rulebook") {
      postcondition = this.rulebookPostcondition(entry.expected);
    } else if (entry.action === "submit-proposal" && entry.expected?.kind === "submission") {
      postcondition = this.submissionPostcondition(entry.expected);
    } else if (entry.action === "review-submission") {
      postcondition = this.reviewPostcondition(entry.entityId);
    }
    if (!postcondition) throw new PendingWriteError(entry.hash);
    return this.reconcile(entry.action, entry.entityId, entry.hash, postcondition, onStage);
  }

  /**
   * Read a receipt for `hash`, tolerating the RPC's intermittent failures.
   * Waits for FINALIZED — the classifier additionally requires AGREE and a
   * successful execution result, so FINALIZED alone is never treated as
   * success. Returns null when the receipt cannot be read.
   */
  private async tryReceipt(hash: string): Promise<TransactionReceipt | null> {
    try {
      return (await this.client.waitForTransactionReceipt({
        hash: hash as TransactionHash,
        status: TransactionStatus.FINALIZED,
        retries: 60,
        interval: 5_000,
      })) as TransactionReceipt;
    } catch {
      return null;
    }
  }

  /**
   * Reconcile an already-broadcast hash. Never resends.
   *
   * The receipt is strictly classified first, then the method-specific
   * postcondition is the real gate before the journal is cleared. An unreadable
   * or unsettled receipt remains pending even if matching state is readable.
   */
  private async reconcile(
    action: string,
    entityId: string,
    hash: string,
    postcondition: Postcondition,
    onStage?: (stage: WriteStage) => void,
  ): Promise<WriteResult> {
    onStage?.("confirming");

    const receipt = await this.tryReceipt(hash);
    if (!receipt) {
      // The outcome is unknown. Keep the hash pending; do not resend.
      throw new PendingWriteError(hash);
    }

    const cls = classify(receipt);
    if (!cls.ok) {
      if (cls.consensusStatus === "UNKNOWN") {
        throw new PendingWriteError(hash);
      }
      // Conclusive failure — retain an auditable record, never auto-resend.
      markTransactionFailed(action, entityId, cls.reason);
      throw new WriteFailedError(hash, cls.reason);
    }

    // Consensus agreed and execution succeeded — confirm the state materialized.
    if (!(await postcondition())) {
      throw new PendingWriteError(hash);
    }

    clearTransaction(action, entityId, receipt);
    onStage?.("finalized");
    return { hash, receipt };
  }

  /**
   * Hash-first write. If a hash is already journalled for this action, reconcile
   * that exact hash instead of sending a new one. A send that throws issued no
   * hash, so nothing committed; once a hash exists we never send again.
   */
  private async writeWithRecovery(
    action: string,
    entityId: string,
    functionName: string,
    args: unknown[],
    postcondition: Postcondition,
    expected?: PendingExpected,
    onStage?: (stage: WriteStage) => void,
  ): Promise<WriteResult> {
    const pending = getPendingTransaction(action, entityId);
    if (pending) {
      return this.reconcile(action, entityId, pending.hash, postcondition, onStage);
    }

    const hash = (await this.client.writeContract({
      address: this.address,
      functionName,
      args,
      value: 0n,
    })) as string;
    rememberTransaction(action, entityId, hash, expected);
    onStage?.("sent");

    return this.reconcile(action, entityId, hash, postcondition, onStage);
  }

  async createRulebook(
    id: string,
    title: string,
    description: string,
    rules: string,
    onStage?: (stage: WriteStage) => void,
  ) {
    try {
      await this.getRulebook(id);
      throw new Error("A Rulebook with this ID already exists.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) throw error;
      if (!(error instanceof Error) || !/unknown rulebook|not found/i.test(error.message)) {
        throw new Error("Could not verify the current Rulebook state. No transaction was sent.");
      }
    }

    const postcondition: Postcondition = async () => {
      try {
        const rb = await this.getRulebook(id);
        const ids = await this.getRulebookIds();
        return (
          rb.rulebook_id === id &&
          rb.title === title &&
          rb.description === description &&
          rb.rules === rules &&
          rb.active === true &&
          ids.includes(id)
        );
      } catch {
        return false;
      }
    };

    return this.writeWithRecovery(
      "create-rulebook",
      id,
      "create_rulebook",
      [id, title, description, rules],
      postcondition,
      { kind: "rulebook", id, title, description, rules },
      onStage,
    );
  }

  async submitProposal(
    id: string,
    rulebookId: string,
    title: string,
    proposalText: string,
    onStage?: (stage: WriteStage) => void,
  ) {
    try {
      await this.getSubmission(id);
      throw new Error("A submission with this ID already exists.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) throw error;
      if (!(error instanceof Error) || !/unknown submission|not found/i.test(error.message)) {
        throw new Error("Could not verify the current submission state. No transaction was sent.");
      }
    }

    const postcondition: Postcondition = async () => {
      try {
        const sub = await this.getSubmission(id);
        const ids = await this.getSubmissionIds();
        return (
          sub.submission_id === id &&
          sub.rulebook_id === rulebookId &&
          sub.title === title &&
          sub.proposal_text === proposalText &&
          sub.status === "SUBMITTED" &&
          sub.verdict === "" &&
          sub.certificate_issued === false &&
          ids.includes(id)
        );
      } catch {
        return false;
      }
    };

    return this.writeWithRecovery(
      "submit-proposal",
      id,
      "submit_proposal",
      [id, rulebookId, title, proposalText],
      postcondition,
      { kind: "submission", id, rulebookId, title, proposalText },
      onStage,
    );
  }

  async reviewSubmission(id: string, onStage?: (stage: WriteStage) => void) {
    const current = await this.getSubmission(id);
    if (current.status === "REVIEWED") {
      return { hash: null, receipt: null, alreadyFinalized: true };
    }

    // The verdict is nondeterministic, so the postcondition asserts the
    // certificate invariant rather than a specific verdict: a REVIEWED
    // submission carries a certificate and a verified digest iff it is COMPLIANT.
    const postcondition: Postcondition = async () => {
      try {
        const sub = await this.getSubmission(id);
        if (sub.status !== "REVIEWED") return false;
        if (!["COMPLIANT", "NON_COMPLIANT", "UNCLEAR"].includes(sub.verdict)) return false;
        const cert = await this.getCertificate(id);

        if (sub.verdict === "COMPLIANT") {
          if (!sub.certificate_issued || !sub.result_digest) return false;
          if (!cert || cert.verdict !== "COMPLIANT" || cert.result_digest !== sub.result_digest) return false;
          const rb = await this.getRulebook(sub.rulebook_id);
          const recomputed = await recomputeResultDigest(rb, sub, "COMPLIANT");
          return recomputed === sub.result_digest;
        }

        // NON_COMPLIANT and UNCLEAR: no certificate, empty digest.
        return sub.certificate_issued === false && sub.result_digest === "" && cert === null;
      } catch {
        return false;
      }
    };

    return this.writeWithRecovery(
      "review-submission",
      id,
      "review_submission",
      [id],
      postcondition,
      { kind: "review", id },
      onStage,
    );
  }
}

export default ClauseGate;
