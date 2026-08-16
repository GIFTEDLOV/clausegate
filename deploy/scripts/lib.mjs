/**
 * lib.mjs — shared Bradbury release primitives for the ClauseGate harness.
 *
 * Ported from the proven UptimeBond release path. Product logic is not carried
 * over; only the release/transaction/deployment safety mechanisms are.
 *
 * Key handling: the signing key comes from the OS keychain the GenLayer CLI
 * populates (service "genlayer-cli", account "account:NAME"), is held only in
 * memory, and goes straight to the SDK signer. Nothing here logs, returns,
 * serializes, or persists key material, and no function accepts a key argument.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const gljs = require("genlayer-js");
const keytar = require("keytar");

const { createClient, createAccount, chains } = gljs;

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CHAIN = chains.testnetBradbury;
export const EXPECTED_CHAIN_ID = 4221;
export const RPC_URL = "https://rpc-bradbury.genlayer.com";
export const EXPLORER = "https://explorer-bradbury.genlayer.com";
export const EXPLORER_API = `${EXPLORER}/api/v1`;
const KEYCHAIN_SERVICE = "genlayer-cli";

export const CONTRACT_PATH = resolve(ROOT, "contracts", "clausegate.py");

export const EXPECTED_CONTRACT_INFO = {
  name: "ClauseGate",
  version: "1.0.0",
  tagline: "Rules in. Decisions out.",
  verdicts: ["COMPLIANT", "NON_COMPLIANT", "UNCLEAR"],
  max_rulebook_rules: 12_000,
  max_proposal: 16_000,
};

// ---------------------------------------------------------------- source bytes
/** The exact bytes that will be submitted as the deploy payload. */
export function contractBytes() {
  return new Uint8Array(readFileSync(CONTRACT_PATH));
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Utf8(text) {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

/** SHA-256, byte length, and a CRLF check over the frozen contract source. */
export function frozenSource() {
  const bytes = contractBytes();
  const hasCrlf = bytes.includes(0x0d);
  return {
    path: CONTRACT_PATH,
    sha256: sha256Bytes(bytes),
    bytes: bytes.length,
    hasCrlf,
  };
}

// -------------------------------------------------------------- canonical JSON
function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortDeep(value[k]);
    return out;
  }
  return value;
}

/** Recursively sorted keys, no whitespace — matches Python json.dumps. */
export function canonicalJson(value) {
  return JSON.stringify(sortDeep(value));
}

/** Independent recomputation of the contract's result_digest. */
export function resultDigest(rulebook, submission, verdict) {
  const payload = canonicalJson({
    rulebook: {
      id: rulebook.rulebook_id,
      title: rulebook.title,
      description: rulebook.description,
      rules: rulebook.rules,
    },
    submission: {
      id: submission.submission_id,
      submitter: submission.submitter,
      title: submission.title,
      proposal_text: submission.proposal_text,
    },
    verdict,
  });
  return sha256Utf8(payload);
}

// -------------------------------------------------------------------- signing
export async function isUnlocked(name) {
  return (await keytar.getPassword(KEYCHAIN_SERVICE, `account:${name}`)) !== null;
}

export async function signer(name) {
  const key = await keytar.getPassword(KEYCHAIN_SERVICE, `account:${name}`);
  if (!key) {
    throw new Error(
      `account '${name}' is locked. Unlock it yourself with:\n` +
        `  genlayer account unlock --account ${name}\n` +
        `This harness never accepts, prompts for, or stores a password or key.`,
    );
  }
  return createAccount(key); // in memory only
}

export async function client(account) {
  if (Number(CHAIN.id) !== EXPECTED_CHAIN_ID) {
    throw new Error(`wrong chain: expected ${EXPECTED_CHAIN_ID}, got ${CHAIN.id}`);
  }
  return createClient(account ? { chain: CHAIN, account } : { chain: CHAIN });
}

// ------------------------------------------------------------------- receipts
/**
 * Strict classification. Success requires a settled consensus that AGREEd and a
 * successful execution result. FINALIZED/ACCEPTED alone is never success, and an
 * unrecognised execution result stays UNKNOWN rather than being promoted.
 */
export function classify(r) {
  const consensus = up(r?.status_name ?? r?.statusName ?? r?.status);
  const vote = up(r?.result_name ?? r?.resultName ?? r?.result);
  const exec = up(r?.tx_execution_result_name ?? r?.txExecutionResultName ?? r?.execution_result);
  const round = r?.last_round ?? r?.lastRound ?? {};
  const votes = round?.validatorVotesName ?? round?.validator_votes_name ?? r?.validators ?? [];
  const list = Array.isArray(votes) ? votes.map(String) : [];
  const tally = list.reduce((m, v) => ({ ...m, [v]: (m[v] ?? 0) + 1 }), {});
  const ok =
    consensus === "FINALIZED" &&
    vote === "AGREE" &&
    (exec === "FINISHED_WITH_RETURN" || exec === "FINISHED_WITH_NO_RETURN");
  return {
    ok,
    consensus_status: consensus,
    consensus_result: vote,
    execution_result: exec,
    validator_votes: list,
    validator_tally: tally,
  };
}

function up(v) {
  if (typeof v === "string" && v.length) return v.toUpperCase();
  if (typeof v === "number") return String(v);
  return "UNKNOWN";
}

/** Rich receipt via RPC; tolerates the endpoint's intermittent failures. */
export async function tryReceipt(c, hash, { status = "FINALIZED", retries = 200, interval = 5000 } = {}) {
  try {
    return await c.waitForTransactionReceipt({ hash, status, retries, interval });
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------- explorer
export async function explorerTx(hash) {
  try {
    const r = await fetch(`${EXPLORER_API}/transactions/${hash}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- reads
export async function readMethod(c, address, functionName, args = []) {
  return c.readContract({ address, functionName, args, jsonSafeReturn: true });
}

// --------------------------------------------------------------- journal I/O
export function save(file, obj) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(jsonSafe(obj), null, 2) + "\n");
}

export function load(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function jsonSafe(v) {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = jsonSafe(x);
    return o;
  }
  return v;
}

export function nowIso() {
  return new Date().toISOString();
}

/**
 * Pure: should we reconcile an existing hash rather than broadcast? True iff a
 * hash is recorded for THIS source SHA — regardless of the journal's status
 * text. A "FAILED" note never bypasses a persisted hash.
 */
export function shouldReconcile(journal, frozenSha) {
  return Boolean(journal && journal.txHash && journal.frozen && journal.frozen.sha256 === frozenSha);
}

// ---------------------------------------------------------- retry (pre-hash only)
const RETRYABLE = [
  "pipeline backpressure",
  "not currently accepting transactions",
  "nonce too low",
  "nonce is not consistent",
  "replacement transaction underpriced",
  "econnreset",
  "etimedout",
  "socket hang up",
  "fetch failed",
  "internal error",
  "service unavailable",
  "bad gateway",
  "gateway timeout",
];

export function isRetryable(e) {
  const m = `${e?.shortMessage ?? ""} ${e?.message ?? ""} ${e?.details ?? ""}`.toLowerCase();
  return RETRYABLE.some((s) => m.includes(s));
}

/**
 * Submit a transaction, retrying ONLY when the node refused it before issuing a
 * hash. `submit` must resolve to a tx hash. If it throws, no hash was issued so
 * nothing committed and a retry cannot double-write. Once a hash exists this
 * never retries — an in-flight transaction is resolved by observation, never by
 * resending.
 */
export async function submitPreHash(submit, { attempts = 5, baseMs = 15_000, onRetry } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await submit();
    } catch (e) {
      lastErr = e;
      if (!isRetryable(e)) throw e;
      const wait = Math.min(baseMs * 2 ** i, 120_000);
      if (onRetry) onRetry(i + 1, attempts, Math.round(wait / 1000), e?.shortMessage ?? e?.message ?? String(e));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
