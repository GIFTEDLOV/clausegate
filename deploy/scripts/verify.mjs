/**
 * verify.mjs — deployment materialization and method postconditions.
 *
 * A finalized deploy transaction is NOT proof a contract exists. UptimeBond
 * proved Bradbury can report FINALIZED / FINISHED_WITH_RETURN / AGREE and name
 * an address at which no contract actually lives. So a deployment is treated as
 * real only after every check below passes, in order.
 */

import { createHash } from "node:crypto";
import { EXPECTED_CONTRACT_INFO, classify, readMethod, resultDigest, sha256Utf8 } from "./lib.mjs";

function sha256Any(code) {
  if (code == null) return null;
  if (typeof code === "string") {
    // A 0x-hex blob hashes over its raw bytes; source text hashes over utf8.
    if (/^0x[0-9a-fA-F]*$/.test(code) && code.length > 2) {
      return createHash("sha256").update(Buffer.from(code.slice(2), "hex")).digest("hex");
    }
    return sha256Utf8(code);
  }
  if (code instanceof Uint8Array || Buffer.isBuffer(code)) {
    return createHash("sha256").update(Buffer.from(code)).digest("hex");
  }
  return null;
}

function codeLength(code) {
  if (code == null) return 0;
  if (typeof code === "string") return code.length;
  if (code.length != null) return code.length;
  return 0;
}

/** Pure: does the deployed source hash equal the frozen source hash? */
export function sourceMatches(deployedSha, frozenSha) {
  return Boolean(deployedSha) && deployedSha === frozenSha;
}

/** Pure: does contract_info() match ClauseGate's expected identity exactly? */
export function contractInfoMatches(info) {
  if (!info || typeof info !== "object") return false;
  const e = EXPECTED_CONTRACT_INFO;
  const verdicts = Array.isArray(info.verdicts) ? info.verdicts : [];
  return (
    info.name === e.name &&
    info.version === e.version &&
    info.tagline === e.tagline &&
    verdicts.length === e.verdicts.length &&
    e.verdicts.every((v, i) => verdicts[i] === v) &&
    Number(info.max_rulebook_rules) === e.max_rulebook_rules &&
    Number(info.max_proposal) === e.max_proposal
  );
}

function addressFromReceipt(receipt) {
  const d = receipt?.data ?? {};
  const decoded = receipt?.txDataDecoded ?? {};
  const candidates = [
    d.contract_address,
    decoded.contractAddress,
    receipt?.contractAddress,
    receipt?.recipient,
    receipt?.to_address,
  ].filter((x) => typeof x === "string" && /^0x[0-9a-fA-F]{40}$/.test(x));
  // Distinct address fields must agree.
  const uniq = [...new Set(candidates.map((a) => a.toLowerCase()))];
  return { address: candidates[0] ?? null, agree: uniq.length <= 1, candidates: uniq };
}

/**
 * Full materialization verification (section 7, checks A–K). Runs each check in
 * order, stops at the first failure, and never reports a later check as passed.
 */
export async function verifyDeployment(c, receipt, frozen) {
  const checks = [];
  const push = (id, ok, detail) => checks.push({ id, ok, detail });
  const finish = (address, info) => ({
    ok: checks.every((x) => x.ok === true),
    address: checks.every((x) => x.ok === true) ? address : null,
    claimedAddress: address,
    contractInfo: info ?? null,
    checks,
  });

  const cls = classify(receipt);

  // A. FINALIZED
  if (cls.consensus_status !== "FINALIZED") {
    push("finalized", false, `consensus status is ${cls.consensus_status}, not FINALIZED`);
    return finish(null);
  }
  push("finalized", true, "FINALIZED");

  // B. execution success
  if (!(cls.execution_result === "FINISHED_WITH_RETURN" || cls.execution_result === "FINISHED_WITH_NO_RETURN")) {
    push("execution", false, `execution result is ${cls.execution_result}`);
    return finish(null);
  }
  push("execution", true, cls.execution_result);

  // C. consensus AGREE
  if (cls.consensus_result !== "AGREE") {
    push("consensus", false, `consensus result is ${cls.consensus_result}, not AGREE`);
    return finish(null);
  }
  push("consensus", true, "AGREE");

  // D/E. address recoverable and, if multiple, in agreement
  const { address, agree, candidates } = addressFromReceipt(receipt);
  if (!address) {
    push("address", false, "the finalized receipt names no contract address");
    return finish(null);
  }
  if (!agree) {
    push("address", false, `receipt address fields disagree: ${candidates.join(", ")}`);
    return finish(address);
  }
  push("address", true, address);

  // F. code present
  let code;
  try {
    code = await c.getContractCode(address);
  } catch {
    code = null;
  }
  if (!code || codeLength(code) === 0) {
    push("code", false, "no contract code present at this address");
    return finish(address);
  }
  push("code", true, `${codeLength(code)} chars of contract code present`);

  // G. deployed source hash == frozen source hash
  const deployedSha = sha256Any(code);
  if (!sourceMatches(deployedSha, frozen.sha256)) {
    push("source", false, `deployed source sha ${String(deployedSha).slice(0, 16)}… != frozen ${frozen.sha256.slice(0, 16)}…`);
    return finish(address);
  }
  push("source", true, `sha256 ${deployedSha.slice(0, 16)}…`);

  // H/I. contract_info readable and identity matches
  let info;
  try {
    info = await readMethod(c, address, "contract_info", []);
  } catch {
    info = null;
  }
  if (!info) {
    push("contract_info", false, "contract_info() did not answer");
    return finish(address);
  }
  if (!contractInfoMatches(info)) {
    push("contract_info", false, `contract_info identity mismatch: ${JSON.stringify(info)}`);
    return finish(address, info);
  }
  push("contract_info", true, `${info.name} ${info.version}`);

  // J. fresh: rulebook ids empty
  let rbIds;
  try {
    rbIds = await readMethod(c, address, "get_rulebook_ids", []);
  } catch {
    rbIds = null;
  }
  if (!Array.isArray(rbIds) || rbIds.length !== 0) {
    push("fresh_rulebooks", false, `get_rulebook_ids not empty/readable: ${JSON.stringify(rbIds)}`);
    return finish(address, info);
  }
  push("fresh_rulebooks", true, "[]");

  // K. fresh: submission ids empty
  let subIds;
  try {
    subIds = await readMethod(c, address, "get_submission_ids", []);
  } catch {
    subIds = null;
  }
  if (!Array.isArray(subIds) || subIds.length !== 0) {
    push("fresh_submissions", false, `get_submission_ids not empty/readable: ${JSON.stringify(subIds)}`);
    return finish(address, info);
  }
  push("fresh_submissions", true, "[]");

  return finish(address, info);
}

// ------------------------------------------------------------- postconditions
export async function postCreateRulebook(c, address, expected) {
  const rb = await readMethod(c, address, "get_rulebook", [expected.id]);
  const ids = await readMethod(c, address, "get_rulebook_ids", []);
  const ok =
    rb &&
    rb.rulebook_id === expected.id &&
    rb.title === expected.title &&
    rb.description === expected.description &&
    rb.rules === expected.rules &&
    rb.active === true &&
    Array.isArray(ids) &&
    ids.includes(expected.id);
  return { ok: Boolean(ok), rulebook: rb, ids };
}

export async function postSubmit(c, address, expected) {
  const sub = await readMethod(c, address, "get_submission", [expected.id]);
  const ids = await readMethod(c, address, "get_submission_ids", []);
  const ok =
    sub &&
    sub.submission_id === expected.id &&
    sub.rulebook_id === expected.rulebookId &&
    sub.title === expected.title &&
    sub.proposal_text === expected.proposalText &&
    sub.status === "SUBMITTED" &&
    sub.verdict === "" &&
    sub.certificate_issued === false &&
    Array.isArray(ids) &&
    ids.includes(expected.id);
  return { ok: Boolean(ok), submission: sub, ids };
}

/**
 * Review postcondition + certificate invariant, with independent digest
 * recomputation for COMPLIANT. Returns the observed verdict and evidence.
 */
export async function postReview(c, address, submissionId) {
  const sub = await readMethod(c, address, "get_submission", [submissionId]);
  const cert = await readMethod(c, address, "get_certificate", [submissionId]);
  const certificate = cert && Object.keys(cert).length ? cert : null;

  if (!sub || sub.status !== "REVIEWED") {
    return { ok: false, submission: sub, certificate, reason: "not REVIEWED" };
  }
  if (!["COMPLIANT", "NON_COMPLIANT", "UNCLEAR"].includes(sub.verdict)) {
    return { ok: false, submission: sub, certificate, reason: `unknown verdict ${sub.verdict}` };
  }

  if (sub.verdict === "COMPLIANT") {
    if (!sub.certificate_issued || !sub.result_digest) {
      return { ok: false, submission: sub, certificate, reason: "COMPLIANT without certificate/digest" };
    }
    if (!certificate || certificate.verdict !== "COMPLIANT" || certificate.result_digest !== sub.result_digest) {
      return { ok: false, submission: sub, certificate, reason: "certificate does not match submission" };
    }
    const rb = await readMethod(c, address, "get_rulebook", [sub.rulebook_id]);
    const recomputed = resultDigest(rb, sub, "COMPLIANT");
    if (recomputed !== sub.result_digest) {
      return { ok: false, submission: sub, certificate, reason: "recomputed digest mismatch", recomputed };
    }
    return { ok: true, verdict: "COMPLIANT", submission: sub, certificate, recomputed, digestVerified: true };
  }

  // NON_COMPLIANT / UNCLEAR: uncertified, empty digest, empty certificate.
  const ok = sub.certificate_issued === false && sub.result_digest === "" && certificate === null;
  return { ok, verdict: sub.verdict, submission: sub, certificate, reason: ok ? undefined : "uncertified invariant violated" };
}
