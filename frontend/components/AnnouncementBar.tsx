import { ArrowUpRight } from "lucide-react";
import { transactionExplorerUrl } from "@/lib/genlayer/explorer";

const deploymentTx = "0xf368d4c9c188ccc5f5475b6dab9df7e88e3b2e6ec068e50ea8c33899e86d1c78";

export function AnnouncementBar() {
  return (
    <div className="announcement-bar">
      <div className="announcement-inner">
        <span>ClauseGate is live on GenLayer Bradbury</span>
        <a href={transactionExplorerUrl(deploymentTx)} target="_blank" rel="noreferrer">
          View deployment transaction <ArrowUpRight size={13} />
        </a>
      </div>
    </div>
  );
}
