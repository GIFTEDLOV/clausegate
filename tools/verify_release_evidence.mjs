import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = (relative) => JSON.parse(readFileSync(resolve(root, relative), "utf8"));
const manifest = readJson("deploy/bradbury/release-manifest.json");
const deployment = readJson("deploy/bradbury/deployment.json");
const rulebook = readJson("deploy/bradbury/rulebook.json");
const compliant = {
  submit: readJson("deploy/bradbury/compliant/submit.json"),
  review: readJson("deploy/bradbury/compliant/review.json"),
  final: readJson("deploy/bradbury/compliant/final-state.json"),
};
const noncompliant = {
  submit: readJson("deploy/bradbury/noncompliant/submit.json"),
  review: readJson("deploy/bradbury/noncompliant/review.json"),
  final: readJson("deploy/bradbury/noncompliant/final-state.json"),
};

const checks = [];
function check(name, condition, detail = "") {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  checks.push(name);
}
function tx(value, name) {
  check(`${name} shape`, typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value), String(value));
}
function address(value, name) {
  check(`${name} shape`, typeof value === "string" && /^0x[0-9a-f]{40}$/i.test(value), String(value));
}

const source = readFileSync(resolve(root, "contracts/clausegate.py"));
const sourceSha = createHash("sha256").update(source).digest("hex");
const sourceBytes = source.byteLength;

try {
  check("manifest schema", manifest.schema_version === 1);
  check("chain id", manifest.network.chain_id === 4221);
  check("network", manifest.network.chain_name === "GenLayer Bradbury Testnet");
  check("RPC", manifest.network.rpc_url === "https://rpc-bradbury.genlayer.com");
  address(manifest.deployment.contract_address, "production contract");
  check("production contract", manifest.deployment.contract_address === "0x49446d1e225Ba9821d38457DcdCAb31b2170c061");
  tx(manifest.deployment.tx_hash, "deployment tx");
  check("deployment status", manifest.deployment.consensus_status === "FINALIZED");
  check("deployment consensus", manifest.deployment.consensus_result === "AGREE");
  check("deployment execution", manifest.deployment.execution_result === "FINISHED_WITH_RETURN");

  check("frozen source SHA", sourceSha === manifest.contract_source.sha256, `${sourceSha} !== ${manifest.contract_source.sha256}`);
  check("frozen source bytes", sourceBytes === manifest.contract_source.bytes, `${sourceBytes} !== ${manifest.contract_source.bytes}`);
  check("source is LF only", !source.includes(Buffer.from([13, 10])));
  check("deployment source SHA", deployment.deployedSourceSha256 === manifest.contract_source.sha256);
  check("deployment source bytes", deployment.sourceBytes === manifest.contract_source.bytes);
  check("deployment tx matches", deployment.txHash === manifest.deployment.tx_hash);
  address(deployment.contractAddress, "materialized contract");
  check("materialized address", deployment.contractAddress === manifest.deployment.contract_address);

  tx(manifest.rulebook.tx_hash, "Rulebook tx");
  check("Rulebook evidence", rulebook.status === "VERIFIED");
  check("Rulebook consensus", rulebook.consensus === "AGREE" && rulebook.execution === "FINISHED_WITH_RETURN");
  check("Rulebook id", rulebook.rulebook_id === manifest.rulebook.id);
  check("Rulebook tx", rulebook.tx_hash === manifest.rulebook.tx_hash);

  for (const [label, proof] of [["compliant", compliant], ["noncompliant", noncompliant]]) {
    tx(proof.submit.tx_hash, `${label} submit tx`);
    tx(proof.review.tx_hash, `${label} review tx`);
    check(`${label} submit evidence`, proof.submit.status === "FINALIZED" && /verified/i.test(proof.submit.postcondition ?? ""));
    check(`${label} review evidence`, proof.review.status === "FINALIZED" && proof.review.consensus === "AGREE" && proof.review.execution === "FINISHED_WITH_RETURN");
    check(`${label} submit id`, proof.submit.submission_id === proof.final.submission_id);
  }

  check("COMPLIANT finalized", compliant.review.consensus === "AGREE" && compliant.review.execution === "FINISHED_WITH_RETURN");
  check("COMPLIANT verdict", compliant.final.status === "REVIEWED" && compliant.final.verdict === "COMPLIANT");
  check("COMPLIANT certificate", compliant.final.certificate_issued === true && compliant.final.certificate && compliant.final.certificate.verdict === "COMPLIANT");
  check("COMPLIANT digest present", /^[0-9a-f]{64}$/.test(compliant.final.result_digest));
  check("COMPLIANT certificate digest", compliant.final.certificate.result_digest === compliant.final.result_digest);
  check("COMPLIANT digest record", /independently verified/i.test(compliant.final.digest_verification));

  check("NON_COMPLIANT finalized", noncompliant.review.consensus === "AGREE" && noncompliant.review.execution === "FINISHED_WITH_RETURN");
  check("NON_COMPLIANT verdict", noncompliant.final.status === "REVIEWED" && noncompliant.final.verdict === "NON_COMPLIANT");
  check("NON_COMPLIANT certificate absent", noncompliant.final.certificate_issued === false && noncompliant.final.certificate === null && noncompliant.final.result_digest === "");
  check("NON_COMPLIANT has no certificate artifact", !Object.hasOwn(noncompliant.final, "certificate_digest"));

  console.log(`verify:evidence: PASS (${checks.length} checks)`);
  console.log("digest recomputation: SKIPPED_MISSING_SUBMITTER (the preserved offline artifact records independent verification but does not contain submitter)");
} catch (error) {
  console.error(`verify:evidence: FAIL: ${error.message}`);
  process.exitCode = 1;
}
