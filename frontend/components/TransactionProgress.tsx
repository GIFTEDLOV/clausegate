import type { WriteStage } from "@/lib/contracts/types";

const labels: Record<WriteStage, string> = {
  connecting: "Connect your wallet to continue",
  sent: "Transaction sent",
  confirming: "Validators confirming",
  finalized: "Finalized",
  error: "Could not confirm this transaction",
};

export function TransactionProgress({ stage, hash }: { stage: WriteStage | null; hash?: string | null }) {
  if (!stage) return null;
  const active = stage !== "finalized" && stage !== "error";
  return (
    <div className={`transaction-progress ${stage === "error" ? "transaction-error" : ""}`} aria-live="polite">
      <span className={`progress-mark ${active ? "progress-mark-active" : ""}`}>{stage === "finalized" ? "✓" : "•"}</span>
      <div>
        <p className="text-sm font-medium">{labels[stage]}</p>
        {stage === "confirming" && <p className="mt-0.5 text-xs text-muted">Reviews can take a little while while the network reaches agreement.</p>}
        {stage === "error" && <p className="mt-0.5 text-xs text-muted">Your transaction hash is saved. Refreshing will not submit it again.</p>}
        {hash && <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Technical details</summary><code className="mt-1 block break-all">{hash}</code></details>}
      </div>
    </div>
  );
}
