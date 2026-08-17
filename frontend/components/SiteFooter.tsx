import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { contractExplorerUrl, transactionExplorerUrl } from "@/lib/genlayer/explorer";
import { DEPLOYMENT } from "@/lib/config/deployment";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-identity">
          <Link href="/" className="footer-wordmark">ClauseGate</Link>
          <p>Rules in. Decisions out.</p>
        </div>
        <div className="footer-column">
          <p className="footer-label">Product</p>
          <Link href="/rulebooks">Rulebooks</Link>
          <Link href="/submissions">Submissions</Link>
          <Link href="/decisions">Decisions</Link>
          <Link href="/certificates">Certificates</Link>
          <Link href="/rulebooks/new">Create Rulebook</Link>
        </div>
        <div className="footer-column">
          <p className="footer-label">Technology</p>
          <Link href="/#how-it-works">How it works</Link>
          <a href="https://www.genlayer.com" target="_blank" rel="noreferrer">GenLayer <ArrowUpRight size={13} /></a>
          <a href={transactionExplorerUrl(DEPLOYMENT.deploymentTx)} target="_blank" rel="noreferrer">View deployment <ArrowUpRight size={13} /></a>
        </div>
        <div className="footer-column">
          <p className="footer-label">Developers</p>
          <a href="https://github.com/GIFTEDLOV/clausegate" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13} /></a>
          <a href={contractExplorerUrl(DEPLOYMENT.contractAddress)} target="_blank" rel="noreferrer">View contract <ArrowUpRight size={13} /></a>
        </div>
      </div>
      <div className="footer-bottom"><span>© 2026 ClauseGate.</span><span>Built on GenLayer.</span></div>
    </footer>
  );
}
