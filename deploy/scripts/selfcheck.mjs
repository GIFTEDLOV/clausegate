/**
 * selfcheck.mjs — targeted release-safety regression checks (section 10).
 *
 * These are deterministic and offline: they exercise the pure classifier,
 * deployment-verification decisions, source freeze, SDK pin, and chain binding.
 * They do NOT re-run Stage 5 or the contract suite. Run: node deploy/scripts/selfcheck.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ROOT, CHAIN, EXPECTED_CHAIN_ID, RPC_URL, frozenSource, classify, shouldReconcile,
} from "./lib.mjs";
import { verifyDeployment, sourceMatches, contractInfoMatches } from "./verify.mjs";
import { EXPECTED_CONTRACT_INFO } from "./lib.mjs";

const EXPECTED_SHA = "47817b41586e44ac1a08b2a5daff8b184a0f9c69e9f020d23cf43dce8d87810d";
const EXPECTED_BYTES = 12195;

let passed = 0;
function check(name, fn) {
  return fn().then(
    () => { console.log(`  ok  ${name}`); passed++; },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );
}
const sync = (name, fn) => check(name, async () => fn());

const receipt = (status, result, exec, votes = ["AGREE", "AGREE"]) => ({
  status_name: status, result_name: result, tx_execution_result_name: exec,
  last_round: { validatorVotesName: votes },
});

async function main() {
  // 1. SDK exactly pinned (no caret) in both manifests and resolved to 1.1.8.
  await sync("1 SDK pinned exactly to 1.1.8", () => {
    const rootPkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    const fePkg = JSON.parse(readFileSync(resolve(ROOT, "frontend", "package.json"), "utf8"));
    assert.equal(rootPkg.devDependencies["genlayer-js"], "1.1.8", "root pin");
    assert.equal(fePkg.dependencies["genlayer-js"], "1.1.8", "frontend pin");
    const lock = JSON.parse(readFileSync(resolve(ROOT, "package-lock.json"), "utf8"));
    const versions = Object.entries(lock.packages)
      .filter(([k]) => k.endsWith("node_modules/genlayer-js"))
      .map(([, v]) => v.version);
    assert.ok(versions.length > 0, "genlayer-js present in lockfile");
    for (const v of versions) assert.equal(v, "1.1.8", "only 1.1.8 resolved");
  });

  // 2. Contract source is canonical LF and hash-stable.
  await sync("2 source canonical LF + hash stable", () => {
    const f = frozenSource();
    assert.equal(f.hasCrlf, false, "no CRLF");
    assert.equal(f.bytes, EXPECTED_BYTES, "byte length");
    assert.equal(f.sha256, EXPECTED_SHA, "sha256");
  });

  // 3. Bradbury chain object is used by the SDK + frontend production binding.
  await sync("3 Bradbury chain binding (id 4221, RPC)", () => {
    assert.equal(Number(CHAIN.id), EXPECTED_CHAIN_ID);
    assert.equal(CHAIN.rpcUrls.default.http[0], RPC_URL);
    const net = readFileSync(resolve(ROOT, "frontend", "lib", "genlayer", "network.ts"), "utf8");
    assert.ok(net.includes("chains.testnetBradbury"), "frontend binds testnetBradbury");
    assert.ok(net.includes("4221") && net.includes("0x107d"), "frontend chain constants");
    // No production client may bind studionet.
    for (const rel of ["frontend/lib/genlayer/client.ts", "frontend/lib/contracts/ClauseGate.ts"]) {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      assert.ok(!/studionet/.test(src), `${rel} must not reference studionet`);
    }
  });

  // 4. FINALIZED + execution error is rejected.
  sync("4 FINALIZED + FINISHED_WITH_ERROR rejected", () =>
    assert.equal(classify(receipt("FINALIZED", "AGREE", "FINISHED_WITH_ERROR")).ok, false));

  // 5. ACCEPTED is not a settled success state.
  sync("5 ACCEPTED is not success", () =>
    assert.equal(classify(receipt("ACCEPTED", "AGREE", "FINISHED_WITH_RETURN")).ok, false));

  // 6. FINALIZED + DISAGREE is rejected.
  sync("6 FINALIZED + DISAGREE rejected", () =>
    assert.equal(classify(receipt("FINALIZED", "DISAGREE", "FINISHED_WITH_RETURN")).ok, false));

  // 7. FINALIZED + missing execution result is not success.
  sync("7 FINALIZED + missing execution result not success", () => {
    const r = { status_name: "FINALIZED", result_name: "AGREE" };
    const c = classify(r);
    assert.equal(c.ok, false);
    assert.equal(c.execution_result, "UNKNOWN");
  });

  // 8. FINALIZED + AGREE + FINISHED_WITH_RETURN succeeds.
  sync("8 FINALIZED + AGREE + FINISHED_WITH_RETURN succeeds", () =>
    assert.equal(classify(receipt("FINALIZED", "AGREE", "FINISHED_WITH_RETURN")).ok, true));

  // 9. A persisted tx hash is reconciled even if the journal says FAILED.
  sync("9 persisted hash reconciled despite FAILED status", () => {
    const journal = { txHash: "0xabc", stage: "FAILED", frozen: { sha256: EXPECTED_SHA } };
    assert.equal(shouldReconcile(journal, EXPECTED_SHA), true);
    assert.equal(shouldReconcile({ stage: "FAILED" }, EXPECTED_SHA), false, "no hash -> no reconcile target");
  });

  // 10. Unknown polling does not resolve to success (stays UNKNOWN, never rebroadcast).
  sync("10 unknown/unreadable receipt stays UNKNOWN", () => {
    const c = classify(null);
    assert.equal(c.ok, false);
    assert.equal(c.consensus_status, "UNKNOWN");
  });

  // 11. Deployment verification rejects missing contract code.
  await check("11 verification rejects missing code", async () => {
    const mock = {
      async getContractCode() { return ""; },
      async readContract() { throw new Error("unreached"); },
    };
    const v = await verifyDeployment(
      mock,
      receipt("FINALIZED", "AGREE", "FINISHED_WITH_RETURN"),
      { sha256: EXPECTED_SHA },
    );
    // Need an address in the receipt for the code check to be reached.
    const v2 = await verifyDeployment(
      { ...mock },
      { ...receipt("FINALIZED", "AGREE", "FINISHED_WITH_RETURN"), data: { contract_address: "0x" + "1".repeat(40) } },
      { sha256: EXPECTED_SHA },
    );
    assert.equal(v.ok, false);
    assert.equal(v2.ok, false);
    assert.equal(v2.checks.find((x) => x.id === "code").ok, false);
  });

  // 12. Deployment verification rejects a source-hash mismatch.
  await check("12 verification rejects source-hash mismatch", async () => {
    const mock = {
      async getContractCode() { return "print('not clausegate')"; },
      async readContract() { throw new Error("unreached"); },
    };
    const v = await verifyDeployment(
      mock,
      { ...receipt("FINALIZED", "AGREE", "FINISHED_WITH_RETURN"), data: { contract_address: "0x" + "2".repeat(40) } },
      { sha256: EXPECTED_SHA },
    );
    assert.equal(v.ok, false);
    assert.equal(v.checks.find((x) => x.id === "source").ok, false);
    assert.equal(sourceMatches("deadbeef", EXPECTED_SHA), false);
    assert.equal(sourceMatches(EXPECTED_SHA, EXPECTED_SHA), true);
  });

  // 13. The certificate/identity gates the postcondition uses are correct.
  sync("13 postcondition identity gates", () => {
    assert.equal(contractInfoMatches(EXPECTED_CONTRACT_INFO), true);
    assert.equal(contractInfoMatches({ ...EXPECTED_CONTRACT_INFO, version: "9.9.9" }), false);
    assert.equal(contractInfoMatches({ ...EXPECTED_CONTRACT_INFO, verdicts: ["COMPLIANT"] }), false);
  });
}

main().then(() => {
  if (process.exitCode) {
    console.error(`\nselfcheck FAILED`);
  } else {
    console.log(`\nselfcheck: ${passed} checks passed`);
  }
});
