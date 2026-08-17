import { ArrowUpRight } from "lucide-react";
import { transactionExplorerUrl } from "@/lib/genlayer/explorer";
import { DEPLOYMENT } from "@/lib/config/deployment";

export function AnnouncementBar() {
  return (
    <div className="announcement-bar">
      <div className="announcement-inner">
        <span>ClauseGate is live on GenLayer Bradbury</span>
        <a href={transactionExplorerUrl(DEPLOYMENT.deploymentTx)} target="_blank" rel="noreferrer">
          View deployment transaction <ArrowUpRight size={13} />
        </a>
      </div>
    </div>
  );
}
