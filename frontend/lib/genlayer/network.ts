/**
 * Production network binding — GenLayer Bradbury testnet.
 *
 * One rule drives this module: the production app talks to Bradbury through the
 * SDK's own chain object, never a Studionet chain with a Bradbury label bolted
 * on. Every read client, write client, wallet switch, and deployment record
 * resolves the chain from `chains.testnetBradbury` in the pinned genlayer-js,
 * and the constants below are asserted against it at import time. If the
 * installed SDK ever disagreed with these values we fail closed rather than
 * silently deploying to or reading from the wrong network.
 */

import { chains } from "genlayer-js";

/** The authoritative SDK chain object. All clients bind to exactly this. */
export const BRADBURY_CHAIN = chains.testnetBradbury;

export const CHAIN_ID = 4221;
export const CHAIN_ID_HEX = "0x107d";
export const CHAIN_NAME = "GenLayer Bradbury Testnet";
export const RPC_URL = "https://rpc-bradbury.genlayer.com";
export const SYMBOL = "GEN";
export const EXPLORER = "https://explorer-bradbury.genlayer.com";

/** The exact genlayer-js this bundle is built against — pinned in package.json
 *  and recorded with every deployment so a record names the SDK that produced it. */
export const SDK_VERSION = "1.1.8";

/** SHA-256 and byte length of contracts/clausegate.py over its canonical LF
 *  bytes (pinned by .gitattributes). Recorded with every deployment and checked
 *  against the on-chain code during materialization verification. */
export const CONTRACT_SOURCE_SHA256 =
  "47817b41586e44ac1a08b2a5daff8b184a0f9c69e9f020d23cf43dce8d87810d";
export const CONTRACT_SOURCE_BYTES = 12195;

/** Expected identity returned by contract_info(), mirrored from the contract. */
export const EXPECTED_CONTRACT_INFO = {
  name: "ClauseGate",
  version: "1.0.0",
  tagline: "Rules in. Decisions out.",
  verdicts: ["COMPLIANT", "NON_COMPLIANT", "UNCLEAR"],
  max_rulebook_rules: 12_000,
  max_proposal: 16_000,
} as const;

function rpcOf(chain: unknown): string {
  const c = chain as { rpcUrls?: { default?: { http?: string[] } } };
  return c?.rpcUrls?.default?.http?.[0] ?? "";
}

/**
 * Fail closed if the installed SDK chain is not the Bradbury we expect. Called
 * once at import so a mismatched SDK can never reach a client factory.
 */
function assertBradbury(): void {
  const id = Number((BRADBURY_CHAIN as { id?: number }).id);
  if (id !== CHAIN_ID) {
    throw new Error(
      `Refusing to run: SDK chain id is ${id}, expected Bradbury ${CHAIN_ID}. ` +
        `This build must not mix a Bradbury label with a non-Bradbury SDK chain.`,
    );
  }
  const rpc = rpcOf(BRADBURY_CHAIN);
  if (rpc && rpc !== RPC_URL) {
    throw new Error(
      `Refusing to run: SDK Bradbury RPC is ${rpc}, expected ${RPC_URL}.`,
    );
  }
}

assertBradbury();

/**
 * Resolve the production RPC URL. An env override is honoured only when it
 * points at the Bradbury host; anything else (e.g. a Studionet URL) fails
 * closed instead of silently mixing networks.
 */
export function resolveRpcUrl(): string {
  const override = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL;
  if (override && override !== RPC_URL) {
    let host = "";
    try {
      host = new URL(override).host;
    } catch {
      throw new Error(`NEXT_PUBLIC_GENLAYER_RPC_URL is not a valid URL: ${override}`);
    }
    if (host !== "rpc-bradbury.genlayer.com") {
      throw new Error(
        `NEXT_PUBLIC_GENLAYER_RPC_URL (${override}) is not a Bradbury RPC. ` +
          `Production is pinned to ${RPC_URL}; refusing to run on a mixed network.`,
      );
    }
    return override;
  }
  return RPC_URL;
}
