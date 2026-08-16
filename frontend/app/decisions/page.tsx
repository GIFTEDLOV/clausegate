"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { VerdictBadge } from "@/components/VerdictBadge";
import { useSubmissions } from "@/lib/hooks/useClauseGate";

export default function DecisionsPage() {
  const query = useSubmissions();
  const decisions = query.data?.filter((submission) => submission.status === "REVIEWED") || [];
  const columns = { gridTemplateColumns: "1.25fr 1.15fr .75fr .7fr auto" };

  return <AppShell><section className="container app-main"><div className="page-header"><div><p className="eyebrow">Decision ledger</p><h1 className="page-title">Decisions</h1><p className="page-description">Finalized compliance decisions reached through GenLayer consensus.</p></div></div>{query.isLoading ? <div className="registry"><div className="skeleton" style={{ height: 100 }} /><div className="skeleton" style={{ height: 100, marginTop: 12 }} /></div> : query.error ? <div className="form-error" style={{ marginTop: 30 }}>We couldn&apos;t load finalized decisions right now. Please try again.</div> : decisions.length ? <div className="registry" aria-label="Finalized decisions"><div className="registry-header" style={columns}><span>Decision</span><span>Rulebook</span><span>Verdict</span><span>Status</span><span>Action</span></div>{decisions.map((decision) => <Link key={decision.submission_id} href={`/submissions/${encodeURIComponent(decision.submission_id)}`} className="registry-row" style={columns}><div><div className="registry-primary">{decision.title}</div><div className="registry-secondary font-mono">{decision.submission_id}</div></div><div className="registry-cell font-mono">{decision.rulebook_id}</div><div className="registry-cell"><VerdictBadge verdict={decision.verdict} /></div><div className="registry-cell">{decision.status}</div><span className="registry-action">View decision <ArrowRight size={14} /></span></Link>)}</div> : <div className="empty-state"><h2>No finalized decisions yet.</h2><p className="muted" style={{ marginTop: 8 }}>Reviewed submissions will appear here after consensus finalizes.</p><Link href="/submissions" className="button-secondary" style={{ marginTop: 24 }}>Browse submissions</Link></div>}</section></AppShell>;
}
