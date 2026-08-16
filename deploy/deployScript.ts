import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  DecodedDeployData,
  GenLayerChain,
  GenLayerClient,
  TransactionHash,
  TransactionStatus,
} from "genlayer-js/types";
import { testnetBradbury } from "genlayer-js/chains";

type DeploymentJournal = {
  contract: string;
  sourcePath: string;
  sourceSha256: string;
  sourceBytes?: number;
  network?: string;
  chainId?: number;
  sdkVersion?: string;
  status: string;
  txHash?: string;
  receipt?: Record<string, unknown>;
  contractAddress?: string;
  contractInfo?: unknown;
  error?: string;
};

const EXPECTED_CHAIN_ID = Number(testnetBradbury.id);

const artifactPath = path.resolve(process.cwd(), "artifacts/clausegate-deployment.json");

function saveJournal(journal: DeploymentJournal) {
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(journal, null, 2)}\n`);
}

function loadJournal(): DeploymentJournal | null {
  if (!existsSync(artifactPath)) return null;
  try {
    return JSON.parse(readFileSync(artifactPath, "utf8")) as DeploymentJournal;
  } catch {
    return null;
  }
}

async function finalizeExisting(client: GenLayerClient<any>, journal: DeploymentJournal) {
  if (!journal.txHash) throw new Error("Deployment journal has no transaction hash");
  const receipt = await client.waitForTransactionReceipt({
    hash: journal.txHash as TransactionHash,
    status: TransactionStatus.FINALIZED,
    retries: 200,
    interval: 3_000,
  });
  const raw = receipt as unknown as Record<string, unknown>;
  const status = String(raw.statusName ?? raw.status_name ?? "").toUpperCase();
  const result = String(raw.resultName ?? raw.result_name ?? "").toUpperCase();
  const execution = String(
    raw.txExecutionResultName ?? raw.tx_execution_result_name ?? "",
  ).toUpperCase();
  if (
    (status !== TransactionStatus.FINALIZED && raw.status !== 6) ||
    result !== "AGREE" ||
    !["FINISHED_WITH_RETURN", "FINISHED_WITH_NO_RETURN"].includes(execution)
  ) {
    throw new Error(`Deployment is not finalized: ${JSON.stringify(receipt)}`);
  }
  journal.status = "FINALIZED";
  journal.receipt = receipt as unknown as Record<string, unknown>;
  saveJournal(journal);
  return receipt;
}

export default async function main(client: GenLayerClient<any>) {
  const sourcePath = path.resolve(process.cwd(), "contracts/clausegate.py");
  const code = new Uint8Array(readFileSync(sourcePath));
  if (code.includes(0x0d)) {
    throw new Error("Refusing to deploy: contracts/clausegate.py must contain canonical LF bytes");
  }
  if (Number((client.chain as GenLayerChain).id) !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Refusing to deploy: client chain is ${String((client.chain as GenLayerChain).id)}, ` +
        `expected Bradbury ${EXPECTED_CHAIN_ID}`,
    );
  }
  const sourceSha256 = createHash("sha256").update(code).digest("hex");
  const prior = loadJournal();

  if (prior?.txHash) {
    if (prior.sourceSha256 !== sourceSha256) {
      throw new Error(
        `A deployment transaction already exists for a different source SHA (${prior.sourceSha256}); refusing to redeploy`,
      );
    }
    const receipt = await finalizeExisting(client, prior);
    if (prior.contractAddress) {
      const info = await client.readContract({ address: prior.contractAddress as `0x${string}`, functionName: "contract_info", args: [] });
      prior.contractInfo = info;
      saveJournal(prior);
      console.log(JSON.stringify({ ...prior, receipt }, null, 2));
      return;
    }
    throw new Error("Existing deployment hash was reconciled without an address; refusing to redeploy");
  }

  const journal: DeploymentJournal = {
    contract: "ClauseGate",
    sourcePath,
    sourceSha256,
    sourceBytes: code.length,
    network: testnetBradbury.name,
    chainId: EXPECTED_CHAIN_ID,
    sdkVersion: "1.1.8",
    status: "PREPARED",
  };

  try {
    await client.initializeConsensusSmartContract();
    const txHash = await client.deployContract({ code, args: [] });
    journal.status = "BROADCAST";
    journal.txHash = txHash;
    saveJournal(journal);

    const receipt = await finalizeExisting(client, journal);
    const contractAddress = (
      receipt.data?.contract_address ??
      (receipt.txDataDecoded as DecodedDeployData)?.contractAddress
    ) as string | undefined;
    if (!contractAddress) throw new Error(`Finalized deployment did not include a contract address: ${JSON.stringify(receipt)}`);

    journal.contractAddress = contractAddress;
    journal.status = "FINALIZED";
    journal.receipt = receipt as unknown as Record<string, unknown>;
    journal.contractInfo = await client.readContract({ address: contractAddress as `0x${string}`, functionName: "contract_info", args: [] });
    saveJournal(journal);
    console.log(JSON.stringify(journal, null, 2));
  } catch (error) {
    journal.status = "FAILED";
    journal.error = error instanceof Error ? error.message : String(error);
    saveJournal(journal);
    throw error;
  }
}
