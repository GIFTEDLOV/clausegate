import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient, createAccount, chains } = require("genlayer-js");

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const CHAIN = chains.testnetBradbury;
export const EXPECTED_CHAIN_ID = 4221;
export const RPC_URL = "https://rpc-bradbury.genlayer.com";
export const EXPLORER = "https://explorer-bradbury.genlayer.com";
export const EXPLORER_API = `${EXPLORER}/api/v1`;
export const EXPECTED_V2_SOURCE_PATH = resolve(ROOT, "contracts", "clausegate_v2.py");
export const CONTRACT_PATH = EXPECTED_V2_SOURCE_PATH;
export const JOURNAL_PATH = resolve(ROOT, "deploy", "bradbury", "v2", "deployment.json");
export const DEPLOY_CONFIRM = "DEPLOY_EVIDENCE_BOUND_V2";
export const EXPECTED_V2_SOURCE_SHA256 = "008a92aa6f081e0cb19c7279bde10c6ad96db4e00a071a769d194d24c48ee748";
export const EXPECTED_V2_SOURCE_BYTES = 35013;
export const EXPECTED_CONTRACT_INFO = {
  name: "ClauseGate",
  version: "2.0.0",
  tagline: "Rules in. Decisions out.",
  verdicts: ["COMPLIANT", "NON_COMPLIANT", "UNCLEAR"],
  max_rulebook_rules: 12_000,
  max_proposal: 16_000,
  max_evidence_items: 4,
  max_evidence_url: 500,
  max_evidence_claim: 1_000,
  evidence_types: ["GITHUB_REPOSITORY", "WEB_PAGE"],
};

export function contractBytes() { return new Uint8Array(readFileSync(CONTRACT_PATH)); }
export function sha256Bytes(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
export function sha256Utf8(text) { return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex"); }
export function frozenSource() {
  const bytes = contractBytes();
  return { path: CONTRACT_PATH, sha256: sha256Bytes(bytes), bytes: bytes.length, hasCrlf: bytes.includes(0x0d) };
}

export function assertFrozenSource(frozen) {
  if (CONTRACT_PATH !== EXPECTED_V2_SOURCE_PATH || frozen.path !== EXPECTED_V2_SOURCE_PATH) throw new Error("v2 source path differs from contracts/clausegate_v2.py");
  if (frozen.sha256 !== EXPECTED_V2_SOURCE_SHA256) throw new Error(`v2 source SHA differs from reviewed candidate: ${frozen.sha256}`);
  if (frozen.bytes !== EXPECTED_V2_SOURCE_BYTES) throw new Error(`v2 source byte count differs from reviewed candidate: ${frozen.bytes}`);
  if (frozen.hasCrlf) throw new Error("v2 source contains CRLF");
  return frozen;
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key]);
    return out;
  }
  return value;
}
export function canonicalJson(value) { return JSON.stringify(sortDeep(value)); }
export function evidenceAssessmentDigest(evidence, assessment) { return sha256Utf8(canonicalJson({ evidence, assessment })); }
export function resultDigestV2(rulebook, submission, verdict) {
  const evidence = submission.evidence || [];
  const assessment = submission.evidence_assessment || [];
  const assessmentDigest = submission.evidence_assessment_digest || evidenceAssessmentDigest(evidence, assessment);
  return sha256Utf8(canonicalJson({
    rulebook: { id: rulebook.rulebook_id, title: rulebook.title, description: rulebook.description, rules: rulebook.rules },
    submission: { id: submission.submission_id, submitter: submission.submitter, title: submission.title, proposal_text: submission.proposal_text },
    evidence,
    evidence_commitment: submission.evidence_commitment || "",
    evidence_assessment: assessment,
    evidence_assessment_digest: assessmentDigest,
    verdict,
  }));
}

export function jsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
  return value;
}
export function save(file, value) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(jsonSafe(value), null, 2) + "\n"); }
export function load(file) { if (!existsSync(file)) return null; try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } }
export function nowIso() { return new Date().toISOString(); }

export function shouldReconcile(journal, frozenSha) { return Boolean(journal?.txHash && journal?.frozen?.sha256 === frozenSha); }

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
  const message = `${e?.shortMessage ?? ""} ${e?.message ?? ""} ${e?.details ?? ""}`.toLowerCase();
  return RETRYABLE.some((item) => message.includes(item));
}

export async function submitPreHash(submit, { attempts = 5, baseMs = 15_000, onRetry } = {}) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await submit();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      const wait = Math.min(baseMs * 2 ** index, 120_000);
      onRetry?.(index + 1, attempts, Math.round(wait / 1000), error?.shortMessage ?? error?.message ?? String(error));
      await new Promise((resolveWait) => setTimeout(resolveWait, wait));
    }
  }
  throw lastError;
}
export function up(value) { return typeof value === "string" && value ? value.toUpperCase() : "UNKNOWN"; }
export function classify(receipt) {
  const consensus = up(receipt?.status_name ?? receipt?.statusName ?? receipt?.status);
  const vote = up(receipt?.result_name ?? receipt?.resultName ?? receipt?.result);
  const exec = up(receipt?.tx_execution_result_name ?? receipt?.txExecutionResultName ?? receipt?.execution_result);
  const round = receipt?.last_round ?? receipt?.lastRound ?? {};
  const votes = round?.validatorVotesName ?? round?.validator_votes_name ?? receipt?.validators ?? [];
  const list = Array.isArray(votes) ? votes.map(String) : [];
  return { ok: consensus === "FINALIZED" && vote === "AGREE" && ["FINISHED_WITH_RETURN", "FINISHED_WITH_NO_RETURN"].includes(exec), consensus_status: consensus, consensus_result: vote, execution_result: exec, validator_votes: list };
}
export function sourceMatches(deployed, frozen) { return Boolean(deployed) && deployed === frozen; }
export function contractInfoMatches(info) {
  if (!info || typeof info !== "object") return false;
  const e = EXPECTED_CONTRACT_INFO;
  return info.name === e.name && info.version === e.version && info.tagline === e.tagline && JSON.stringify(info.verdicts) === JSON.stringify(e.verdicts) && Number(info.max_rulebook_rules) === e.max_rulebook_rules && Number(info.max_proposal) === e.max_proposal && Number(info.max_evidence_items) === e.max_evidence_items && Number(info.max_evidence_url) === e.max_evidence_url && Number(info.max_evidence_claim) === e.max_evidence_claim && JSON.stringify(info.evidence_types) === JSON.stringify(e.evidence_types);
}
export async function client(account) {
  if (Number(CHAIN.id) !== EXPECTED_CHAIN_ID) throw new Error("v2 deployment chain mismatch");
  return createClient(account ? { chain: CHAIN, account } : { chain: CHAIN });
}
export async function signer(name) {
  const keytar = require("keytar");
  const key = await keytar.getPassword("genlayer-cli", `account:${name}`);
  if (!key) throw new Error(`account '${name}' is locked; unlock it with genlayer account unlock`);
  return createAccount(key);
}
export async function isUnlocked(name) { const keytar = require("keytar"); return (await keytar.getPassword("genlayer-cli", `account:${name}`)) !== null; }
export async function tryReceipt(c, hash, options = {}) { try { return await c.waitForTransactionReceipt({ hash, status: "FINALIZED", retries: 240, interval: 5000, ...options }); } catch { return null; } }
export async function readMethod(c, address, functionName, args = []) { return c.readContract({ address, functionName, args, jsonSafeReturn: true }); }
export function sha256Any(code) {
  if (code == null) return null;
  if (typeof code === "string" && /^0x[0-9a-fA-F]*$/.test(code) && code.length > 2) return createHash("sha256").update(Buffer.from(code.slice(2), "hex")).digest("hex");
  if (typeof code === "string") return sha256Utf8(code);
  if (code instanceof Uint8Array || Buffer.isBuffer(code)) return sha256Bytes(code);
  return null;
}
export function codeLength(code) { return code == null ? 0 : typeof code === "string" ? code.length : code.length || 0; }
