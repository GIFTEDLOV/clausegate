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
import { localnet } from "genlayer-js/chains";

type DeploymentJournal = {
  contract: string;
  sourcePath: string;
  sourceSha256: string;
  status: string;
  txHash?: string;
  receipt?: Record<string, unknown>;
  contractAddress?: string;
  contractInfo?: unknown;
  error?: string;
};

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
  if (receipt.statusName !== TransactionStatus.FINALIZED && receipt.status !== 6) {
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
  const sourceSha256 = createHash("sha256").update(code).digest("hex");
  const prior = loadJournal();

  if (prior?.sourceSha256 === sourceSha256 && prior.txHash && prior.status !== "FAILED") {
    const receipt = await finalizeExisting(client, prior);
    if (prior.contractAddress) {
      const info = await client.readContract({ address: prior.contractAddress as `0x${string}`, functionName: "contract_info", args: [] });
      prior.contractInfo = info;
      saveJournal(prior);
      console.log(JSON.stringify({ ...prior, receipt }, null, 2));
      return;
    }
  }

  const journal: DeploymentJournal = {
    contract: "ClauseGate",
    sourcePath,
    sourceSha256,
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
      (client.chain as GenLayerChain).id === localnet.id
        ? receipt.data?.contract_address
        : (receipt.txDataDecoded as DecodedDeployData)?.contractAddress
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
