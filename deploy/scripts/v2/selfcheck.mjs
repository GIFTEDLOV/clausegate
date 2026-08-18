import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, CONTRACT_PATH, DEPLOY_CONFIRM, EXPECTED_CHAIN_ID, EXPECTED_CONTRACT_INFO, EXPECTED_V2_SOURCE_BYTES, EXPECTED_V2_SOURCE_PATH, EXPECTED_V2_SOURCE_SHA256, JOURNAL_PATH, canonicalJson, classify, contractInfoMatches, evidenceAssessmentDigest, frozenSource, assertFrozenSource, resultDigestV2, shouldReconcile } from "./lib.mjs";

const checks = [];
function check(id, condition, detail) { checks.push({ id, ok: Boolean(condition), detail }); }

const frozen = frozenSource();
check("v2 source path", frozen.path === EXPECTED_V2_SOURCE_PATH && CONTRACT_PATH === EXPECTED_V2_SOURCE_PATH, CONTRACT_PATH);
check("v1 source excluded", !CONTRACT_PATH.endsWith("contracts\\clausegate.py") && !CONTRACT_PATH.endsWith("contracts/clausegate.py"), CONTRACT_PATH);
check("expected source SHA", frozen.sha256 === EXPECTED_V2_SOURCE_SHA256, `${frozen.sha256} == ${EXPECTED_V2_SOURCE_SHA256}`);
check("expected source bytes", frozen.bytes === EXPECTED_V2_SOURCE_BYTES, `${frozen.bytes} == ${EXPECTED_V2_SOURCE_BYTES}`);
check("v2 journal isolated", JOURNAL_PATH.includes("bradbury\\v2\\") || JOURNAL_PATH.includes("bradbury/v2/"), JOURNAL_PATH);
check("chain", EXPECTED_CHAIN_ID === 4221, String(EXPECTED_CHAIN_ID));
check("LF source", frozen.hasCrlf === false, `${frozen.bytes} bytes`);
try { assertFrozenSource(frozen); check("frozen source assertion", true, "reviewed candidate"); } catch (error) { check("frozen source assertion", false, error.message); }
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

const deploySource = readFileSync(resolve(ROOT, "deploy", "scripts", "v2", "deploy.mjs"), "utf8");
const initializeAt = deploySource.indexOf("initializeConsensusSmartContract");
const deployAt = deploySource.indexOf("c.deployContract");
check("arming guard", deploySource.includes("process.env.CLAUSEGATE_V2_DEPLOY_CONFIRM") && deploySource.includes("!== DEPLOY_CONFIRM") && deploySource.includes("DEPLOY_CONFIRM"), "exact opt-in");
check("BigInt-safe final output", deploySource.includes("JSON.stringify(jsonSafe(journal)"), "jsonSafe final deployment output");
check("consensus initialization before deploy", initializeAt >= 0 && deployAt > initializeAt, `${initializeAt} < ${deployAt}`);
check("pre-hash guarded deployment", deploySource.includes("submitPreHash(") && deploySource.includes("() => c.deployContract"), "submitPreHash");
check("hash-first persistence", deploySource.indexOf("journal.txHash = txHash") > deploySource.indexOf("submitPreHash(") && deploySource.includes("save(JOURNAL_PATH, journal)"), "persist returned hash");
check("reconcile first", deploySource.includes("shouldReconcile(prior, frozen.sha256)") && deploySource.includes("if (prior?.txHash"), "existing hash discipline");

for (const item of checks) console.log(`${item.ok ? "ok" : "FAIL"} ${item.id}: ${item.detail}`);
if (!checks.every((item) => item.ok)) process.exit(1);
console.log(`v2 selfcheck: ${checks.length} checks passed (offline; no wallet/network/write)`);
