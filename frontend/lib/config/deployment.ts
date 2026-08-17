import { CHAIN_ID, CHAIN_NAME, RPC_URL } from "@/lib/genlayer/network";

/** Public, verified ClauseGate deployment facts shared by UI and read-only checks. */
export const DEPLOYMENT = {
  contractAddress: "0x49446d1e225Ba9821d38457DcdCAb31b2170c061",
  chainId: CHAIN_ID,
  networkName: "GenLayer Bradbury",
  chainName: CHAIN_NAME,
  rpcUrl: RPC_URL,
  deploymentTx: "0xf368d4c9c188ccc5f5475b6dab9df7e88e3b2e6ec068e50ea8c33899e86d1c78",
  rulebookTx: "0xd0a0841935068ed33576b96ee55779fcbea4b965ab119904cb037b4b39728e3a",
  canonicalRulebookId: "clausegate-canonical-20260816",
  compliantSubmissionId: "clausegate-compliant-20260816",
  compliantSubmitTx: "0x7327a8d190087273ccd83225fbbc83264f712449a31b399ea55ff70e8c273b8d",
  compliantReviewTx: "0xac0d127d3cfb29fe202d91851129bb77814ef21ba4f17c1d61aee0e07bd675bb",
  noncompliantSubmissionId: "clausegate-noncompliant-20260816",
  noncompliantSubmitTx: "0xa1d9d88f6ec9a4d286cdd9fea429e4ba91fa1b12d81027c6ff6406ac8931f34d",
  noncompliantReviewTx: "0x8a0119082d0b69e1f5833b212d08cb84acf5fe5a09e088f31e560af1e41c30d7",
  frontendUrl: "https://clausegate.vercel.app",
  hardenedReleaseCommit: "66f05ad5700f5b5446f776a653b04bc69b2190f0",
} as const;
