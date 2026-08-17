import { CONTRACT_PATH, EXPECTED_CHAIN_ID, EXPECTED_CONTRACT_INFO, JOURNAL_PATH, canonicalJson, classify, contractInfoMatches, evidenceAssessmentDigest, frozenSource, resultDigestV2, shouldReconcile } from "./lib.mjs";

const checks = [];
function check(id, condition, detail) { checks.push({ id, ok: Boolean(condition), detail }); }

const frozen = frozenSource();
check("v2 source path", CONTRACT_PATH.endsWith("contracts\\clausegate_v2.py") || CONTRACT_PATH.endsWith("contracts/clausegate_v2.py"), CONTRACT_PATH);
check("v1 source excluded", !CONTRACT_PATH.endsWith("contracts\\clausegate.py") && !CONTRACT_PATH.endsWith("contracts/clausegate.py"), CONTRACT_PATH);
check("v2 journal isolated", JOURNAL_PATH.includes("bradbury\\v2\\") || JOURNAL_PATH.includes("bradbury/v2/"), JOURNAL_PATH);
check("chain", EXPECTED_CHAIN_ID === 4221, String(EXPECTED_CHAIN_ID));
check("LF source", frozen.hasCrlf === false, `${frozen.bytes} bytes`);
check("v2 identity", contractInfoMatches(EXPECTED_CONTRACT_INFO), `${EXPECTED_CONTRACT_INFO.name} ${EXPECTED_CONTRACT_INFO.version}`);
check("hash-first same source", shouldReconcile({ txHash: "0xabc", frozen: { sha256: frozen.sha256 } }, frozen.sha256), "reconcile");
check("different source cannot reconcile", !shouldReconcile({ txHash: "0xabc", frozen: { sha256: "0".repeat(64) } }, frozen.sha256), "refuse overwrite");
check("finalized failed execution", classify({ status: "FINALIZED", result: "AGREE", execution_result: "FINISHED_WITH_ERROR" }).ok === false, "not success");
check("finalized agree return", classify({ status: "FINALIZED", result: "AGREE", execution_result: "FINISHED_WITH_RETURN" }).ok === true, "success");
const rulebook = { rulebook_id: "rb", title: "t", description: "d", rules: "r" };
const submission = { submission_id: "sub", submitter: "0x1", title: "s", proposal_text: "p", evidence: [{ type: "WEB_PAGE", url: "https://example.com", claim: "live" }], evidence_commitment: "a".repeat(64), evidence_assessment: [{ index: 0, status: "SUPPORTED", control: "VERIFIED" }], evidence_assessment_digest: "" };
const digest = resultDigestV2(rulebook, submission, "COMPLIANT");
check("v2 digest", typeof digest === "string" && digest.length === 64, digest);
check("assessment digest", evidenceAssessmentDigest(submission.evidence, submission.evidence_assessment).length === 64, "sha256");
check("canonical JSON", canonicalJson({ b: 1, a: 2 }) === '{"a":2,"b":1}', "sort_keys/separators");

for (const item of checks) console.log(`${item.ok ? "ok" : "FAIL"} ${item.id}: ${item.detail}`);
if (!checks.every((item) => item.ok)) process.exit(1);
console.log(`v2 selfcheck: ${checks.length} checks passed (offline; no wallet/network/write)`);
