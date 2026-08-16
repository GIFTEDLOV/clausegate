import { ArrowUpRight } from "lucide-react";
import { EXPLORER } from "@/lib/genlayer/network";

const contract = "0x49446d1e225Ba9821d38457DcdCAb31b2170c061";

export function AnnouncementBar() {
  return (
    <div className="announcement-bar">
      <div className="announcement-inner">
        <span>ClauseGate is live on GenLayer Bradbury</span>
        <a href={`${EXPLORER}/contracts/${contract}`} target="_blank" rel="noreferrer">
          View verified deployment <ArrowUpRight size={13} />
        </a>
      </div>
    </div>
  );
}
