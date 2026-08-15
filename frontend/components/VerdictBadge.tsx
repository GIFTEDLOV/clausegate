import type { Verdict } from "@/lib/contracts/types";

export function VerdictBadge({ verdict }: { verdict: Verdict | "" }) {
  if (!verdict) return <span className="status-badge status-pending">Pending review</span>;
  return <span className={`status-badge status-${verdict.toLowerCase()}`}>{verdict}</span>;
}
