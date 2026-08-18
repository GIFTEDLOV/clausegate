import { DEPLOY_CONFIRM, CHAIN, EXPECTED_CHAIN_ID, EXPLORER, JOURNAL_PATH, contractBytes, frozenSource, assertFrozenSource, isUnlocked, signer, client, tryReceipt, classify, load, nowIso, save, shouldReconcile, submitPreHash } from "./lib.mjs";
import { verifyDeployment } from "./verify.mjs";

if (process.env.CLAUSEGATE_V2_DEPLOY_CONFIRM !== DEPLOY_CONFIRM) {
  throw new Error(`Refusing v2 deployment. Set CLAUSEGATE_V2_DEPLOY_CONFIRM=${DEPLOY_CONFIRM} explicitly.`);
}

const accountName = process.argv[2] || process.env.CLAUSEGATE_DEPLOY_ACCOUNT || "player3";

async function reconcile(c, journal) {
  const receipt = await tryReceipt(c, journal.txHash);
  if (!receipt) { journal.stage = "PENDING"; journal.note = "Receipt unreadable; no redeploy."; journal.updatedAt = nowIso(); save(JOURNAL_PATH, journal); return journal; }
  const classification = classify(receipt);
  journal.receipt = receipt;
  if (!classification.ok) { journal.stage = "FAILED"; journal.note = "Consensus or execution did not succeed; no redeploy."; journal.updatedAt = nowIso(); save(JOURNAL_PATH, journal); return journal; }
  const verified = await verifyDeployment(c, receipt, journal.frozen);
  journal.materialization = verified.checks;
  journal.contractInfo = verified.contractInfo;
  if (!verified.ok) { journal.stage = "UNVERIFIED"; journal.note = "Materialization checks failed; no redeploy."; journal.updatedAt = nowIso(); save(JOURNAL_PATH, journal); return journal; }
  journal.stage = "VERIFIED";
  journal.contractAddress = verified.address;
  journal.updatedAt = nowIso();
  save(JOURNAL_PATH, journal);
  console.log(`V2 deployment verified at ${verified.address}`);
  console.log(`${EXPLORER}/address/${verified.address}`);
  return journal;
}

async function main() {
  const frozen = assertFrozenSource(frozenSource());
  if (Number(CHAIN.id) !== EXPECTED_CHAIN_ID) throw new Error("V2 deployment chain mismatch");
  const prior = load(JOURNAL_PATH);
  if (shouldReconcile(prior, frozen.sha256)) return reconcile(await client(), prior);
  if (prior?.txHash && prior?.frozen?.sha256 !== frozen.sha256) throw new Error("Refusing to overwrite a v2 journal for a different source hash");
  if (!(await isUnlocked(accountName))) throw new Error(`account '${accountName}' is locked`);
  const account = await signer(accountName);
  const c = await client(account);
  const journal = { stage: "PREPARED", contract: "ClauseGate", version: "2.0.0", network: CHAIN.name, chainId: Number(CHAIN.id), frozen, sourcePath: frozen.path, journalPath: JOURNAL_PATH, deployer: account.address, txHash: null, createdAt: nowIso() };
  save(JOURNAL_PATH, journal);
  try {
    await c.initializeConsensusSmartContract().catch(() => {});
  } catch {
    /* already initialized on testnet */
  }
  const txHash = await submitPreHash(
    () => c.deployContract({ code: contractBytes(), args: [] }),
    { onRetry: (attempt, max, seconds, reason) => console.log(`v2 pre-hash retry ${attempt}/${max} in ${seconds}s: ${reason}`) },
  );
  journal.txHash = txHash;
  journal.stage = "BROADCAST";
  journal.submittedAt = nowIso();
  save(JOURNAL_PATH, journal);
  return reconcile(c, journal);
}

main().then((journal) => { console.log(JSON.stringify(journal, null, 2)); process.exit(journal.stage === "VERIFIED" ? 0 : 1); }).catch((error) => { console.error(`v2 deploy error: ${error.message}`); process.exit(1); });
