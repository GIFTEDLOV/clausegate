import { codeLength, contractInfoMatches, readMethod, resultDigestV2, sha256Any, sourceMatches } from "./lib.mjs";

function addressFromReceipt(receipt) {
  const d = receipt?.data ?? {};
  const decoded = receipt?.txDataDecoded ?? {};
  const fields = [d.contract_address, decoded.contractAddress, receipt?.contractAddress, receipt?.recipient, receipt?.to_address].filter((x) => typeof x === "string" && /^0x[0-9a-fA-F]{40}$/.test(x));
  const distinct = [...new Set(fields.map((x) => x.toLowerCase()))];
  return { address: fields[0] || null, agree: distinct.length <= 1 };
}

export async function verifyDeployment(c, receipt, frozen) {
  const checks = [];
  const push = (id, ok, detail) => checks.push({ id, ok, detail });
  const finish = (address, info = null) => ({ ok: checks.every((item) => item.ok), address: checks.every((item) => item.ok) ? address : null, claimedAddress: address, contractInfo: info, checks });
  if (receipt?.status_name !== "FINALIZED" && receipt?.statusName !== "FINALIZED" && receipt?.status !== "FINALIZED") { push("finalized", false, "not FINALIZED"); return finish(null); }
  push("finalized", true, "FINALIZED");
  const execution = receipt?.tx_execution_result_name ?? receipt?.txExecutionResultName ?? receipt?.execution_result;
  if (!["FINISHED_WITH_RETURN", "FINISHED_WITH_NO_RETURN"].includes(execution)) { push("execution", false, String(execution)); return finish(null); }
  push("execution", true, execution);
  const result = receipt?.result_name ?? receipt?.resultName ?? receipt?.result;
  if (result !== "AGREE") { push("consensus", false, String(result)); return finish(null); }
  push("consensus", true, "AGREE");
  const { address, agree } = addressFromReceipt(receipt);
  if (!address) { push("address", false, "no recoverable address"); return finish(null); }
  if (!agree) { push("address", false, "address fields disagree"); return finish(address); }
  push("address", true, address);
  let code = null;
  try { code = await c.getContractCode(address); } catch {}
  if (!code || !codeLength(code)) { push("code", false, "no code"); return finish(address); }
  push("code", true, `${codeLength(code)} bytes/chars`);
  const deployedSha = sha256Any(code);
  if (!sourceMatches(deployedSha, frozen.sha256)) { push("source", false, `${deployedSha} != ${frozen.sha256}`); return finish(address); }
  push("source", true, deployedSha);
  let info = null;
  try { info = await readMethod(c, address, "contract_info", []); } catch {}
  if (!contractInfoMatches(info)) { push("contract_info", false, JSON.stringify(info)); return finish(address, info); }
  push("contract_info", true, "ClauseGate 2.0.0");
  for (const [id, method] of [["fresh_rulebooks", "get_rulebook_ids"], ["fresh_submissions", "get_submission_ids"]]) {
    let ids = null;
    try { ids = await readMethod(c, address, method, []); } catch {}
    if (!Array.isArray(ids) || ids.length) { push(id, false, JSON.stringify(ids)); return finish(address, info); }
    push(id, true, "[]");
  }
  return finish(address, info);
}

function exactAssessment(assessment, count) {
  return Array.isArray(assessment) && assessment.length === count && assessment.every((entry, index) => entry && entry.index === index && ["SUPPORTED", "CONTRADICTED", "INSUFFICIENT"].includes(entry.status) && ["VERIFIED", "MISSING", "MISMATCH"].includes(entry.control));
}

export async function postSubmit(c, address, expected) {
  const sub = await readMethod(c, address, "get_submission", [expected.id]);
  const ids = await readMethod(c, address, "get_submission_ids", []);
  const evidenceMatches = JSON.stringify(sub?.evidence || []) === JSON.stringify(expected.evidence || []);
  const ok = sub?.submission_id === expected.id && sub?.rulebook_id === expected.rulebookId && sub?.title === expected.title && sub?.proposal_text === expected.proposalText && sub?.status === "SUBMITTED" && sub?.verdict === "" && sub?.certificate_issued === false && sub?.evidence_commitment === expected.evidenceCommitment && evidenceMatches && JSON.stringify(sub?.evidence_assessment || []) === "[]" && sub?.evidence_assessment_digest === "" && Array.isArray(ids) && ids.includes(expected.id);
  return { ok: Boolean(ok), submission: sub, ids };
}

export async function postReview(c, address, submissionId) {
  const sub = await readMethod(c, address, "get_submission", [submissionId]);
  const certRaw = await readMethod(c, address, "get_certificate", [submissionId]);
  const cert = certRaw && Object.keys(certRaw).length ? certRaw : null;
  if (!sub || sub.status !== "REVIEWED" || !["COMPLIANT", "NON_COMPLIANT", "UNCLEAR"].includes(sub.verdict)) return { ok: false, submission: sub, certificate: cert, reason: "review postcondition failed" };
  if (!exactAssessment(sub.evidence_assessment, (sub.evidence || []).length)) return { ok: false, submission: sub, certificate: cert, reason: "assessment schema failed" };
  if (sub.verdict === "COMPLIANT") {
    if (!sub.certificate_issued || !cert || cert.certificate_version !== "2" || sub.evidence_assessment.some((entry) => entry.status !== "SUPPORTED" || entry.control !== "VERIFIED")) return { ok: false, submission: sub, certificate: cert, reason: "certificate gating failed" };
    const rb = await readMethod(c, address, "get_rulebook", [sub.rulebook_id]);
    const digest = resultDigestV2(rb, sub, "COMPLIANT");
    return { ok: digest === sub.result_digest && cert.result_digest === digest, submission: sub, certificate: cert, recomputed: digest };
  }
  return { ok: sub.certificate_issued === false && sub.result_digest === "" && !cert, submission: sub, certificate: cert };
}
