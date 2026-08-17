import { createClient, chains } from "genlayer-js";

const address = "0x49446d1e225Ba9821d38457DcdCAb31b2170c061";
const expected = {
  rulebook: "clausegate-canonical-20260816",
  compliant: "clausegate-compliant-20260816",
  noncompliant: "clausegate-noncompliant-20260816",
};

async function main() {
  if (Number(chains.testnetBradbury.id) !== 4221) throw new Error("SDK Bradbury chain id mismatch");
  const client = createClient({ chain: chains.testnetBradbury });
  const read = (functionName, args = []) => client.readContract({ address, functionName, args, jsonSafeReturn: true });
  const info = await read("contract_info");
  if (info?.name !== "ClauseGate" || info?.version !== "1.0.0") throw new Error("contract_info mismatch");
  const rulebookIds = await read("get_rulebook_ids");
  const submissionIds = await read("get_submission_ids");
  if (!rulebookIds.includes(expected.rulebook)) throw new Error("canonical Rulebook is not readable");
  if (!submissionIds.includes(expected.compliant) || !submissionIds.includes(expected.noncompliant)) throw new Error("proof submissions are not readable");
  const compliant = await read("get_submission", [expected.compliant]);
  const noncompliant = await read("get_submission", [expected.noncompliant]);
  const certificate = await read("get_certificate", [expected.compliant]);
  const noncompliantCertificate = await read("get_certificate", [expected.noncompliant]);
  if (compliant?.status !== "REVIEWED" || compliant?.verdict !== "COMPLIANT") throw new Error("COMPLIANT postcondition mismatch");
  if (!certificate || !Object.keys(certificate).length) throw new Error("COMPLIANT certificate missing");
  if (noncompliant?.status !== "REVIEWED" || noncompliant?.verdict !== "NON_COMPLIANT") throw new Error("NON_COMPLIANT postcondition mismatch");
  if (noncompliantCertificate && Object.keys(noncompliantCertificate).length) throw new Error("NON_COMPLIANT certificate unexpectedly exists");
  console.log("verify:production: PASS (read-only contract_info, IDs, proofs, and certificate gates)");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch|network|timeout|closed|connect|rpc/i.test(message)) {
    console.error(`verify:production: BLOCKED_BY_NETWORK: ${message}`);
  } else {
    console.error(`verify:production: MISMATCH: ${message}`);
  }
  process.exitCode = 1;
});
