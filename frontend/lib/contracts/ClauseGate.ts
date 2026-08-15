import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, type TransactionHash } from "genlayer-js/types";

import { getEthereumProvider, getStudioUrl } from "@/lib/genlayer/client";
import {
  clearTransaction,
  getPendingTransaction,
  rememberTransaction,
} from "@/lib/transactions/journal";
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

export class PendingWriteError extends Error {
  readonly hash: string;

  constructor(hash: string) {
    super("This transaction is still waiting for network confirmation.");
    this.name = "PendingWriteError";
    this.hash = hash;
  }
}

export interface WriteResult {
  hash: string | null;
  receipt: TransactionReceipt | null;
  alreadyFinalized?: boolean;
}

export class ClauseGate {
  private readonly address: `0x${string}`;
  private readonly client: any;

  constructor(contractAddress: string, account?: string | null) {
    this.address = contractAddress as `0x${string}`;
    this.client = createClient({
      chain: studionet,
      endpoint: getStudioUrl(),
      provider: getEthereumProvider() || undefined,
      ...(account ? { account: account as `0x${string}` } : {}),
    });
  }

  private async read(functionName: string, args: unknown[] = []) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const value = await this.client.readContract({
          address: this.address,
          functionName,
          args,
        });
        return normalize(value);
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
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

  async waitForHash(hash: string): Promise<TransactionReceipt> {
    return (await this.client.waitForTransactionReceipt({
      hash: hash as TransactionHash,
      status: TransactionStatus.FINALIZED,
      retries: 120,
      interval: 5_000,
    })) as TransactionReceipt;
  }

  private async writeWithRecovery(
    action: string,
    entityId: string,
    functionName: string,
    args: unknown[],
    onStage?: (stage: WriteStage) => void,
  ): Promise<WriteResult> {
    const pending = getPendingTransaction(action, entityId);
    if (pending) {
      onStage?.("confirming");
      try {
        const receipt = await this.waitForHash(pending.hash);
        clearTransaction(action, entityId, receipt);
        onStage?.("finalized");
        return { hash: pending.hash, receipt };
      } catch {
        throw new PendingWriteError(pending.hash);
      }
    }

    const hash = (await this.client.writeContract({
      address: this.address,
      functionName,
      args,
      value: 0n,
    })) as string;
    rememberTransaction(action, entityId, hash);
    onStage?.("sent");
    onStage?.("confirming");

    try {
      const receipt = await this.waitForHash(hash);
      clearTransaction(action, entityId, receipt);
      onStage?.("finalized");
      return { hash, receipt };
    } catch {
      throw new PendingWriteError(hash);
    }
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
    return this.writeWithRecovery("create-rulebook", id, "create_rulebook", [id, title, description, rules], onStage);
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
    return this.writeWithRecovery(
      "submit-proposal",
      id,
      "submit_proposal",
      [id, rulebookId, title, proposalText],
      onStage,
    );
  }

  async reviewSubmission(id: string, onStage?: (stage: WriteStage) => void) {
    const current = await this.getSubmission(id);
    if (current.status === "REVIEWED") {
      return { hash: null, receipt: null, alreadyFinalized: true };
    }
    return this.writeWithRecovery("review-submission", id, "review_submission", [id], onStage);
  }
}

export default ClauseGate;
