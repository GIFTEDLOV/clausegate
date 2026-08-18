import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  ROOT,
  EXPLORER,
  JOURNAL_PATH,
  client,
  frozenSource,
  jsonSafe,
  load,
  nowIso,
  readMethod,
  save,
  signer,
  submitPreHash,
  tryReceipt,
  classify,
} from "./lib.mjs";

const CONTRACT_ADDRESS = "0x25F2c44F55b597B9124Af414F991F1aE68913dBa";
const ACCOUNT_NAME = "player3";
const EXPECTED_SENDER = "0xe0f17BEf0587c3b66D2eB4BBE705dFf821AbDde7";
const SOURCE_URL = "https://github.com/giftedlov/clausegate";
const RAW_CONTROL_URL = "https://raw.githubusercontent.com/giftedlov/clausegate/main/.well-known/clausegate.json";
const PROOF_ROOT = resolve(ROOT, "deploy", "bradbury", "v2", "proof");
const FIXTURE_PATH = resolve(ROOT, ".well-known", "clausegate.json");

const EVIDENCE = [{
  type: "GITHUB_REPOSITORY",
  url: "https://github.com/giftedlov/clausegate",
  claim: "The cited source repository is publicly accessible and licensed under MIT.",
}];

const CASES = {
  compliant: {
    rulebookId: "v2-bradbury-public-mit-20260818",
    rulebook: {
      title: "Public MIT Repository Policy",
      description: "A repository qualifies only when authenticated evidence establishes that it is publicly accessible and licensed under MIT.",
      rules: "1. The cited source repository must be publicly accessible.\n2. The cited source repository must be licensed under MIT.\n3. Unsupported submitter assertions are not sufficient; the decision must rely on the submitted authenticated evidence.",
    },
    submissionId: "v2-bradbury-compliant-20260818",
    submission: {
      title: "ClauseGate Public MIT Repository",
      proposalText: "The ClauseGate project is distributed through the cited public GitHub repository under the MIT License.",
    },
    expectedVerdict: "COMPLIANT",
    expectedEvidenceStatus: "SUPPORTED",
  },
  noncompliant: {
    rulebookId: "v2-bradbury-private-only-20260818",
    rulebook: {
      title: "Private Repository Policy",
      description: "A repository qualifies only if the cited source repository is not publicly accessible.",
      rules: "1. The cited source repository must not be publicly accessible.\n2. The decision must rely on the submitted authenticated evidence rather than unsupported submitter assertions.",
    },
    submissionId: "v2-bradbury-noncompliant-20260818",
    submission: {
      title: "ClauseGate Against Private Repository Policy",
      proposalText: "Evaluate the cited ClauseGate repository against the published private repository requirement.",
    },
    expectedVerdict: "NON_COMPLIANT",
    expectedEvidenceStatus: "CONTRADICTED",
  },
};

function deepSort(value) {
  if (Array.isArray(value)) return value.map(deepSort);
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = deepSort(value[key]);
    return result;
  }
  return value;
}

// Independent proof helper: intentionally duplicated rather than importing the
// contract-facing digest implementation being verified.
function canonicalJson(value) { return JSON.stringify(deepSort(value)); }
function sha256(value) { return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex"); }
function evidenceCommitment(evidence) { return sha256(canonicalJson(evidence)); }
function controlPayload(submission, rulebookId) {
  return {
    schema: "clausegate-control-v1",
    submission_id: submission.submission_id,
    rulebook_id: rulebookId,
    submitter: submission.submitter,
    source_url: submission.evidence[0].url,
    evidence_commitment: submission.evidence_commitment,
  };
}
function controlAttestation(submission, rulebookId) {
  const payload = controlPayload(submission, rulebookId);
  return { ...payload, control_digest: sha256(canonicalJson(payload)) };
}
function assessmentDigest(evidence, assessment) {
  return sha256(canonicalJson({ evidence, assessment }));
}
function resultDigest(rulebook, submission, verdict) {
  const assessment = submission.evidence_assessment || [];
  const digest = submission.evidence_assessment_digest || assessmentDigest(submission.evidence, assessment);
  return sha256(canonicalJson({
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
    evidence: submission.evidence,
    evidence_commitment: submission.evidence_commitment,
    evidence_assessment: assessment,
    evidence_assessment_digest: digest,
    verdict,
  }));
}

function caseConfig(name) {
  const config = CASES[name];
  if (!config) throw new Error(`unknown proof case '${name}'`);
  return config;
}
function caseDir(name) { return resolve(PROOF_ROOT, name); }
function actionPath(name, action) { return resolve(caseDir(name), `${action}.json`); }
function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function sameJson(a, b) { return canonicalJson(a) === canonicalJson(b); }
function errorText(error) { return `${error?.shortMessage ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase(); }

async function readMissing(c, functionName, args) {
  const idsMethod = functionName === "get_rulebook" ? "get_rulebook_ids" : "get_submission_ids";
  const ids = await readMethod(c, CONTRACT_ADDRESS, idsMethod, []);
  if (!Array.isArray(ids) || !ids.includes(args[0])) return null;
  return readMethod(c, CONTRACT_ADDRESS, functionName, args);
}

async function writeAction(name, action, method, args, preexisting, postcondition) {
  mkdirSync(caseDir(name), { recursive: true });
  const journalFile = actionPath(name, action);
  const prior = load(journalFile);
  const readClient = await client();

  if (prior?.txHash) {
    if (prior.sourceContract !== CONTRACT_ADDRESS) throw new Error(`${action}: journal contract mismatch`);
    if (prior.stage === "VERIFIED") return prior;
    return reconcileAction(readClient, journalFile, prior, postcondition);
  }
  if (prior) throw new Error(`${action}: unexplained journal without txHash; refusing to broadcast`);

  const existing = await preexisting(readClient);
  if (existing) {
    throw new Error(`${action}: stable ID already exists without a proof journal; refusing to guess its transaction`);
  }

  const account = await signer(ACCOUNT_NAME);
  if (account.address.toLowerCase() !== EXPECTED_SENDER.toLowerCase()) throw new Error("proof signer does not match intended player3 address");
  const writeClient = await client(account);
  const journal = {
    stage: "PREPARED",
    case: name,
    action,
    method,
    args,
    sourceContract: CONTRACT_ADDRESS,
    sender: account.address,
    createdAt: nowIso(),
    txHash: null,
  };
  save(journalFile, journal);

  const txHash = await submitPreHash(
    () => writeClient.writeContract({ address: CONTRACT_ADDRESS, functionName: method, args, value: 0n }),
    { onRetry: (attempt, max, seconds, reason) => console.log(`${action}: pre-hash retry ${attempt}/${max} in ${seconds}s: ${reason}`) },
  );

  // Hash-first persistence: this is the first operation after the SDK returns.
  journal.txHash = txHash;
  journal.stage = "BROADCAST";
  journal.submittedAt = nowIso();
  save(journalFile, journal);
  return reconcileAction(writeClient, journalFile, journal, postcondition);
}

async function reconcileAction(c, journalFile, journal, postcondition) {
  const receipt = await tryReceipt(c, journal.txHash, { status: "FINALIZED", retries: 720, interval: 5000, fullTransaction: true });
  if (!receipt) {
    journal.stage = "PENDING";
    journal.note = "Receipt unreadable; outcome UNKNOWN. No rebroadcast.";
    journal.updatedAt = nowIso();
    save(journalFile, journal);
    throw new Error(`${journal.action}: receipt outcome UNKNOWN; journal retained, no rebroadcast`);
  }
  const classification = classify(receipt);
  journal.receipt = jsonSafe(receipt);
  journal.classification = classification;
  if (!classification.ok) {
    journal.stage = "FAILED";
    journal.note = "Conclusive consensus or execution failure; no rebroadcast.";
    journal.updatedAt = nowIso();
    save(journalFile, journal);
    throw new Error(`${journal.action}: conclusive failure ${classification.consensus_status}/${classification.consensus_result}/${classification.execution_result}`);
  }
  const result = await postcondition(c);
  if (!result.ok) {
    journal.stage = "UNVERIFIED";
    journal.readback = jsonSafe(result.readback);
    journal.updatedAt = nowIso();
    save(journalFile, journal);
    throw new Error(`${journal.action}: transaction succeeded but postcondition failed`);
  }
  journal.stage = "VERIFIED";
  journal.readback = jsonSafe(result.readback);
  journal.updatedAt = nowIso();
  save(journalFile, journal);
  return journal;
}

function expectedRulebook(c, config) {
  return {
    rulebook_id: config.rulebookId,
    owner: EXPECTED_SENDER,
    title: config.rulebook.title,
    description: config.rulebook.description,
    rules: config.rulebook.rules,
    active: true,
  };
}

async function doRulebook(name) {
  const config = caseConfig(name);
  const expected = expectedRulebook(null, config);
  const journal = await writeAction(
    name,
    "rulebook",
    "create_rulebook",
    [config.rulebookId, config.rulebook.title, config.rulebook.description, config.rulebook.rules],
    (c) => readMissing(c, "get_rulebook", [config.rulebookId]),
    async (c) => {
      const readback = await readMethod(c, CONTRACT_ADDRESS, "get_rulebook", [config.rulebookId]);
      const ids = await readMethod(c, CONTRACT_ADDRESS, "get_rulebook_ids", []);
      return { ok: sameJson(readback, expected) && Array.isArray(ids) && ids.includes(config.rulebookId), readback: { rulebook: readback, ids } };
    },
  );
  save(resolve(caseDir(name), "rulebook-readback.json"), journal.readback);
  console.log(JSON.stringify(jsonSafe(journal), null, 2));
}

async function doSubmission(name) {
  const config = caseConfig(name);
  const evidenceJson = JSON.stringify(EVIDENCE);
  const commitment = evidenceCommitment(EVIDENCE);
  const expected = {
    submission_id: config.submissionId,
    rulebook_id: config.rulebookId,
    title: config.submission.title,
    proposal_text: config.submission.proposalText,
    evidence: EVIDENCE,
    evidence_commitment: commitment,
    status: "SUBMITTED",
    verdict: "",
    certificate_issued: false,
    evidence_assessment: [],
    evidence_assessment_digest: "",
    result_digest: "",
  };
  const journal = await writeAction(
    name,
    "submission",
    "submit_proposal",
    [config.submissionId, config.rulebookId, config.submission.title, config.submission.proposalText, evidenceJson],
    (c) => readMissing(c, "get_submission", [config.submissionId]),
    async (c) => {
      const readback = await readMethod(c, CONTRACT_ADDRESS, "get_submission", [config.submissionId]);
      const ids = await readMethod(c, CONTRACT_ADDRESS, "get_submission_ids", []);
      const exact = readback?.submission_id === expected.submission_id && readback?.rulebook_id === expected.rulebook_id && readback?.title === expected.title && readback?.proposal_text === expected.proposal_text && sameJson(readback?.evidence, expected.evidence) && readback?.evidence_commitment === expected.evidence_commitment && readback?.status === expected.status && readback?.verdict === expected.verdict && readback?.certificate_issued === expected.certificate_issued && sameJson(readback?.evidence_assessment, expected.evidence_assessment) && readback?.evidence_assessment_digest === expected.evidence_assessment_digest && readback?.result_digest === expected.result_digest;
      return { ok: exact && Array.isArray(ids) && ids.includes(config.submissionId), readback: { submission: readback, ids } };
    },
  );
  save(resolve(caseDir(name), "submission-readback.json"), journal.readback);
  console.log(JSON.stringify(jsonSafe(journal), null, 2));
}

async function actualSubmission(name) {
  const config = caseConfig(name);
  const c = await client();
  const submission = await readMethod(c, CONTRACT_ADDRESS, "get_submission", [config.submissionId]);
  if (submission?.submission_id !== config.submissionId || !Array.isArray(submission.evidence) || submission.evidence.length !== 1) throw new Error(`${name}: unexpected submission readback`);
  if (!sameJson(submission.evidence, EVIDENCE)) throw new Error(`${name}: stored evidence differs from canonical evidence`);
  if (submission.evidence_commitment !== evidenceCommitment(submission.evidence)) throw new Error(`${name}: stored evidence commitment does not recompute`);
  return { c, config, submission };
}

async function doControl(name) {
  const { config, submission } = await actualSubmission(name);
  const control = controlAttestation(submission, config.rulebookId);
  const text = JSON.stringify(control, null, 2) + "\n";
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, text, "utf8");
  save(resolve(caseDir(name), "control.json"), control);
  save(resolve(caseDir(name), "control-preimage.json"), { payload: controlPayload(submission, config.rulebookId), canonical_json: canonicalJson(controlPayload(submission, config.rulebookId)), control_digest: control.control_digest });
  console.log(JSON.stringify({ case: name, fixture: FIXTURE_PATH, raw_url: RAW_CONTROL_URL, control, exact_file_text: text }, null, 2));
}

async function doControlCommit(name, commitSha) {
  if (!/^[0-9a-f]{40}$/i.test(commitSha || "")) throw new Error("control commit SHA must be a 40-character Git SHA");
  const control = readJson(resolve(caseDir(name), "control.json"));
  const record = { commit_sha: commitSha, raw_url: RAW_CONTROL_URL, control_digest: control.control_digest, recordedAt: nowIso() };
  if (name === "noncompliant") {
    const prior = readJson(resolve(caseDir("compliant"), "control-commit.json"));
    record.supersedes_compliant_commit_sha = prior.commit_sha;
  }
  save(resolve(caseDir(name), "control-commit.json"), record);
  console.log(JSON.stringify(record, null, 2));
}

async function fetchExactControl(expected) {
  const response = await fetch(RAW_CONTROL_URL, { cache: "no-store" });
  const body = await response.text();
  const expectedText = JSON.stringify(expected, null, 2) + "\n";
  return { ok: response.ok && body === expectedText, status: response.status, body, expectedText, retrievedAt: nowIso() };
}

async function doReview(name) {
  const { c, config, submission } = await actualSubmission(name);
  const existingReview = load(actionPath(name, "review"));
  if (!existingReview?.txHash && (submission.status !== "SUBMITTED" || submission.verdict !== "" || submission.certificate_issued !== false)) throw new Error(`${name}: submission is not reviewable SUBMITTED state`);
  const control = controlAttestation(submission, config.rulebookId);
  const raw = await fetchExactControl(control);
  save(resolve(caseDir(name), "control-retrieval.json"), { url: RAW_CONTROL_URL, status: raw.status, body: raw.body, exact_match: raw.ok, retrievedAt: raw.retrievedAt });
  if (!raw.ok) throw new Error(`${name}: raw control file is not the expected committed attestation; review not sent`);

  const journal = await writeAction(
    name,
    "review",
    "review_submission",
    [config.submissionId],
    async (readClient) => {
      const current = await readMethod(readClient, CONTRACT_ADDRESS, "get_submission", [config.submissionId]);
      return current?.status === "REVIEWED" ? current : null;
    },
    async (readClient) => {
      const sub = await readMethod(readClient, CONTRACT_ADDRESS, "get_submission", [config.submissionId]);
      const assessment = await readMethod(readClient, CONTRACT_ADDRESS, "get_evidence_assessment", [config.submissionId]);
      const certificate = await readMethod(readClient, CONTRACT_ADDRESS, "get_certificate", [config.submissionId]);
      const certObject = certificate && Object.keys(certificate).length ? certificate : {};
      const base = sub?.status === "REVIEWED" && sub?.verdict === config.expectedVerdict && Array.isArray(assessment) && assessment.length === 1 && assessment[0]?.index === 0 && assessment[0]?.control === "VERIFIED";
      let ok = base;
      if (config.expectedVerdict === "COMPLIANT") {
        ok = ok && assessment[0]?.status === "SUPPORTED" && sub.certificate_issued === true && certObject.certificate_version === "2" && certObject.verdict === "COMPLIANT" && certObject.evidence_count === 1 && certObject.evidence_commitment === sub.evidence_commitment && certObject.evidence_assessment_digest === sub.evidence_assessment_digest && certObject.result_digest === sub.result_digest;
      } else {
        ok = ok && assessment[0]?.status === config.expectedEvidenceStatus && sub.certificate_issued === false && sub.result_digest === "" && Object.keys(certObject).length === 0;
      }
      return { ok, readback: { submission: sub, evidence_assessment: assessment, certificate: certObject } };
    },
  );
  save(resolve(caseDir(name), "review-readback.json"), journal.readback);
  console.log(JSON.stringify(jsonSafe(journal), null, 2));
}

async function doDigestVerification(name) {
  const config = caseConfig(name);
  const c = await client();
  const rulebook = await readMethod(c, CONTRACT_ADDRESS, "get_rulebook", [config.rulebookId]);
  const submission = await readMethod(c, CONTRACT_ADDRESS, "get_submission", [config.submissionId]);
  const assessment = await readMethod(c, CONTRACT_ADDRESS, "get_evidence_assessment", [config.submissionId]);
  const certificate = await readMethod(c, CONTRACT_ADDRESS, "get_certificate", [config.submissionId]);
  const independent = {
    evidence_commitment: evidenceCommitment(submission.evidence),
    evidence_assessment_digest: assessmentDigest(submission.evidence, assessment),
    result_digest: submission.verdict === "COMPLIANT" ? resultDigest(rulebook, submission, submission.verdict) : "",
  };
  const matches = submission.verdict === "COMPLIANT"
    ? {
      evidence_commitment: independent.evidence_commitment === submission.evidence_commitment,
      evidence_assessment_digest: independent.evidence_assessment_digest === submission.evidence_assessment_digest && independent.evidence_assessment_digest === certificate.evidence_assessment_digest,
      result_digest: independent.result_digest === submission.result_digest && independent.result_digest === certificate.result_digest,
    }
    : {
      evidence_commitment: independent.evidence_commitment === submission.evidence_commitment,
      assessment_control: assessment.length === 1 && assessment[0].control === "VERIFIED" && assessment[0].status === "CONTRADICTED",
      certificate_absent: Object.keys(certificate).length === 0,
      result_digest_empty: submission.result_digest === "" && submission.evidence_assessment_digest === "",
    };
  if (!Object.values(matches).every(Boolean)) throw new Error(`${name}: independent digest verification failed`);
  const record = { independent, onchain: { evidence_commitment: submission.evidence_commitment, evidence_assessment_digest: submission.evidence_assessment_digest, result_digest: submission.result_digest, certificate }, matches, preimages: { evidence: submission.evidence, assessment, rulebook, submission: { submission_id: submission.submission_id, submitter: submission.submitter, title: submission.title, proposal_text: submission.proposal_text }, verdict: submission.verdict } };
  save(resolve(caseDir(name), "digest-verification.json"), record);
  console.log(JSON.stringify(jsonSafe(record), null, 2));
}

async function doPreflight() {
  const source = frozenSource();
  const c = await client();
  const info = await readMethod(c, CONTRACT_ADDRESS, "contract_info", []);
  const rulebooks = await readMethod(c, CONTRACT_ADDRESS, "get_rulebook_ids", []);
  const submissions = await readMethod(c, CONTRACT_ADDRESS, "get_submission_ids", []);
  const record = { contract: CONTRACT_ADDRESS, source, contract_info: info, rulebook_ids: rulebooks, submission_ids: submissions, readAt: nowIso() };
  save(resolve(PROOF_ROOT, "preflight.json"), record);
  console.log(JSON.stringify(jsonSafe(record), null, 2));
}

async function doManifest() {
  const deployment = readJson(JOURNAL_PATH);
  const compliant = {
    rulebook: readJson(actionPath("compliant", "rulebook")),
    submission: readJson(actionPath("compliant", "submission")),
    control: readJson(resolve(caseDir("compliant"), "control.json")),
    controlCommit: readJson(resolve(caseDir("compliant"), "control-commit.json")),
    review: readJson(actionPath("compliant", "review")),
    readback: readJson(resolve(caseDir("compliant"), "review-readback.json")),
    digestVerification: readJson(resolve(caseDir("compliant"), "digest-verification.json")),
  };
  const noncompliant = {
    rulebook: readJson(actionPath("noncompliant", "rulebook")),
    submission: readJson(actionPath("noncompliant", "submission")),
    control: readJson(resolve(caseDir("noncompliant"), "control.json")),
    controlCommit: readJson(resolve(caseDir("noncompliant"), "control-commit.json")),
    review: readJson(actionPath("noncompliant", "review")),
    readback: readJson(resolve(caseDir("noncompliant"), "review-readback.json")),
    digestVerification: readJson(resolve(caseDir("noncompliant"), "digest-verification.json")),
  };
  const manifest = {
    schema: "clausegate-v2-bradbury-proof-v1",
    generatedAt: nowIso(),
    network: "GenLayer Bradbury",
    chainId: 4221,
    contract: CONTRACT_ADDRESS,
    deployment_tx: deployment.txHash,
    source: { path: "contracts/clausegate_v2.py", sha256: deployment.frozen.sha256, bytes: deployment.frozen.bytes },
    proof_sender: { account: ACCOUNT_NAME, address: EXPECTED_SENDER },
    compliant: {
      rulebook_id: compliant.rulebook.readback.rulebook.rulebook_id,
      rulebook_tx: compliant.rulebook.txHash,
      submission_id: compliant.submission.readback.submission.submission_id,
      submission_tx: compliant.submission.txHash,
      control_file_commit_sha: compliant.controlCommit.commit_sha,
      control_verified_at_review: compliant.controlCommit,
      review_tx: compliant.review.txHash,
      verdict: compliant.readback.submission.verdict,
      assessment: compliant.readback.evidence_assessment,
      certificate: compliant.readback.certificate,
      evidence_commitment: compliant.digestVerification.independent.evidence_commitment,
      assessment_digest: compliant.digestVerification.independent.evidence_assessment_digest,
      result_digest: compliant.digestVerification.independent.result_digest,
      independent_digest_verification: compliant.digestVerification.matches,
    },
    noncompliant: {
      rulebook_id: noncompliant.rulebook.readback.rulebook.rulebook_id,
      rulebook_tx: noncompliant.rulebook.txHash,
      submission_id: noncompliant.submission.readback.submission.submission_id,
      submission_tx: noncompliant.submission.txHash,
      control_file_commit_sha: noncompliant.controlCommit.commit_sha,
      control_verified_at_review: noncompliant.controlCommit,
      review_tx: noncompliant.review.txHash,
      verdict: noncompliant.readback.submission.verdict,
      assessment: noncompliant.readback.evidence_assessment,
      certificate: Object.keys(noncompliant.readback.certificate).length ? noncompliant.readback.certificate : null,
      independent_verification: noncompliant.digestVerification.matches,
    },
  };
  save(resolve(PROOF_ROOT, "manifest.json"), manifest);
  console.log(JSON.stringify(jsonSafe(manifest), null, 2));
}

async function main() {
  const [command, name, value] = process.argv.slice(2);
  if (command === "preflight") return doPreflight();
  if (command === "rulebook") return doRulebook(name);
  if (command === "submission") return doSubmission(name);
  if (command === "control") return doControl(name);
  if (command === "control-commit") return doControlCommit(name, value);
  if (command === "review") return doReview(name);
  if (command === "digest") return doDigestVerification(name);
  if (command === "manifest") return doManifest();
  throw new Error("usage: proof.mjs preflight|rulebook|submission|control|control-commit|review|digest|manifest <case> [commitSha]");
}

main().catch((error) => { console.error(`v2 proof error: ${error.message}`); process.exit(1); });
