/**
 * deploy.mjs — hardened ClauseGate deployment to Bradbury.
 *
 * Discipline (ported from UptimeBond):
 *  - Freeze and hash the exact LF source bytes; record them with the deployment.
 *  - Hash-first: persist the tx hash the instant it exists. If a hash is already
 *    recorded for this source SHA, reconcile THAT transaction first, regardless
 *    of local status text — a FAILED note never bypasses a persisted hash.
 *  - A polling/receipt error is never permission to redeploy. Only a refusal to
 *    accept the transaction (no hash issued) is retried, and only pre-hash.
 *  - Consensus saying FINALIZED/AGREE is not enough: the contract must actually
 *    materialize (code present, source hash matches, identity + fresh state).
 *
 * Usage: node deploy/scripts/deploy.mjs [accountName]   (default: player3)
 */

import { resolve } from "node:path";
import {
  ROOT, EXPECTED_CHAIN_ID, CHAIN, RPC_URL, EXPLORER,
  frozenSource, contractBytes, isUnlocked, signer, client, tryReceipt, classify,
  save, load, nowIso, submitPreHash, jsonSafe, shouldReconcile,
} from "./lib.mjs";
import { verifyDeployment } from "./verify.mjs";

const JOURNAL = resolve(ROOT, "deploy", "bradbury", "deployment.json");
const SDK_VERSION = "1.1.8";

function log(...a) { console.log(...a); }

async function reconcile(c, journal) {
  const hash = journal.txHash;
  log(`Reconciling deploy tx ${hash} (never redeploying while a hash exists)…`);
  const receipt = await tryReceipt(c, hash, { status: "FINALIZED", retries: 240, interval: 5000 });

  if (!receipt) {
    // Unknown outcome. Persist PENDING and stop — do NOT redeploy.
    journal.stage = "PENDING";
    journal.note = "FINALIZED receipt not readable yet; outcome unknown. Not redeploying.";
    journal.updatedAt = nowIso();
    save(JOURNAL, journal);
    log("Outcome UNKNOWN — receipt not readable. Left PENDING; no redeploy. Re-run later to reconcile.");
    return journal;
  }

  const cls = classify(receipt);
  journal.receipt = jsonSafe(receipt);
  journal.consensusStatus = cls.consensus_status;
  journal.consensusResult = cls.consensus_result;
  journal.executionResult = cls.execution_result;
  journal.validatorVotes = cls.validator_votes;
  journal.validatorTally = cls.validator_tally;

  if (!cls.ok) {
    journal.stage = "FAILED";
    journal.note = `Transaction did not succeed: ${cls.consensus_status}/${cls.consensus_result}/${cls.execution_result}`;
    journal.updatedAt = nowIso();
    save(JOURNAL, journal);
    log(`Deploy FAILED: ${journal.note}. Evidence preserved; not redeploying.`);
    return journal;
  }

  // Materialization verification (section 7).
  const frozen = journal.frozen;
  const v = await verifyDeployment(c, receipt, frozen);
  journal.materialization = v.checks;
  journal.contractInfo = v.contractInfo;

  if (!v.ok) {
    journal.stage = "UNVERIFIED";
    journal.claimedAddress = v.claimedAddress;
    journal.note = `Materialization failed at: ${(v.checks.find((x) => !x.ok) || {}).id}`;
    journal.updatedAt = nowIso();
    save(JOURNAL, journal);
    log(`Deploy UNVERIFIED: ${journal.note}. Evidence preserved; not redeploying.`);
    return journal;
  }

  journal.stage = "VERIFIED";
  journal.contractAddress = v.address;
  journal.deployedSourceSha256 = frozen.sha256;
  journal.updatedAt = nowIso();
  save(JOURNAL, journal);
  log(`Deploy VERIFIED. ClauseGate at ${v.address}`);
  log(`Explorer: ${EXPLORER}/address/${v.address}`);
  return journal;
}

async function main() {
  const account = process.argv[2] || process.env.CLAUSEGATE_DEPLOY_ACCOUNT || "player3";

  const frozen = frozenSource();
  if (frozen.hasCrlf) {
    throw new Error("Refusing to deploy: contracts/clausegate.py contains CRLF. Normalize to LF first.");
  }
  log(`Frozen source: ${frozen.bytes} bytes, sha256 ${frozen.sha256}`);
  log(`Chain: ${CHAIN.name} (id ${CHAIN.id}), RPC ${RPC_URL}`);

  if (Number(CHAIN.id) !== EXPECTED_CHAIN_ID) {
    throw new Error(`wrong chain: expected ${EXPECTED_CHAIN_ID}, got ${CHAIN.id}`);
  }
  // Reconcile-first: if a hash exists for this exact source SHA, resolve it and
  // never broadcast again.
  const prior = load(JOURNAL);
  if (shouldReconcile(prior, frozen.sha256)) {
    const c = await client();
    return reconcile(c, prior);
  }
  if (prior?.txHash && prior?.frozen?.sha256 !== frozen.sha256) {
    throw new Error(
      `A deployment record exists for a DIFFERENT source sha (${prior.frozen?.sha256}). ` +
      `Refusing to overwrite it. Inspect deploy/bradbury/deployment.json before proceeding.`,
    );
  }

  if (!(await isUnlocked(account))) {
    throw new Error(`account '${account}' is locked. Unlock with: genlayer account unlock --account ${account}`);
  }

  const acct = await signer(account);
  const c = await client(acct);

  // Persist intent before broadcast.
  const journal = {
    stage: "PREPARED",
    contract: "ClauseGate",
    network: CHAIN.name,
    chainId: Number(CHAIN.id),
    rpc: RPC_URL,
    sdkVersion: SDK_VERSION,
    deployer: acct.address,
    frozen,
    sourceSha256: frozen.sha256,
    sourceBytes: frozen.bytes,
    submittedAt: null,
    txHash: null,
    createdAt: nowIso(),
  };
  save(JOURNAL, journal);

  try {
    await c.initializeConsensusSmartContract().catch(() => {});
  } catch {
    /* already initialized on testnet */
  }

  const code = contractBytes();

  log("Broadcasting deploy…");
  const txHash = await submitPreHash(
    () => c.deployContract({ code, args: [] }),
    { onRetry: (n, max, secs, why) => log(`  pre-hash retry ${n}/${max} in ${secs}s: ${why}`) },
  );

  // Hash-first persistence.
  journal.txHash = txHash;
  journal.stage = "BROADCAST";
  journal.submittedAt = nowIso();
  save(JOURNAL, journal);
  log(`Broadcast. tx=${txHash} (persisted). Waiting for FINALIZED…`);

  return reconcile(c, journal);
}

main()
  .then((j) => {
    console.log("\n=== deployment.json ===");
    console.log(JSON.stringify(jsonSafe(j), null, 2));
    process.exit(j.stage === "VERIFIED" ? 0 : 1);
  })
  .catch((e) => {
    console.error("deploy error:", e?.message ?? e);
    process.exit(1);
  });
