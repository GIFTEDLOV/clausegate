"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { VerdictBadge } from "@/components/VerdictBadge";
import { useSubmissions } from "@/lib/hooks/useClauseGate";

export default function SubmissionsPage() {
  const query = useSubmissions();
  return <AppShell><section className="container app-main"><div className="page-header"><div><p className="eyebrow">Decision ledger</p><h1 className="page-title">Submissions</h1><p className="page-description">Browse proposals and see whether a Rulebook review has reached a terminal decision.</p></div></div>{query.isLoading ? <div className="registry"><div className="skeleton" style={{ height: 100 }} /><div className="skeleton" style={{ height: 100, marginTop: 12 }} /><div className="skeleton" style={{ height: 100, marginTop: 12 }} /></div> : query.error ? <div className="form-error" style={{ marginTop: 30 }}>We couldn&apos;t load submissions right now. Please try again.</div> : query.data?.length ? <div className="registry" aria-label="Submissions"><div className="registry-header" style={{ gridTemplateColumns: "1.4fr 1.2fr .7fr .75fr auto" }}><span>Submission</span><span>Rulebook</span><span>Status</span><span>Verdict</span><span>Action</span></div>{query.data.map((submission) => <Link key={submission.submission_id} href={`/submissions/${encodeURIComponent(submission.submission_id)}`} className="registry-row" style={{ gridTemplateColumns: "1.4fr 1.2fr .7fr .75fr auto" }}><div><div className="registry-primary">{submission.title}</div><div className="registry-secondary">{submission.proposal_text}</div></div><div className="registry-cell font-mono">{submission.rulebook_id}</div><div className="registry-cell">{submission.status}</div><div className="registry-cell">{submission.verdict ? <VerdictBadge verdict={submission.verdict} /> : <span className="status-badge status-pending">SUBMITTED</span>}</div><span className="registry-action">View <ArrowRight size={14} /></span></Link>)}</div> : <div className="empty-state"><h2>No submissions yet.</h2><p className="muted" style={{ marginTop: 8 }}>Choose a Rulebook to submit the first proposal.</p><Link href="/rulebooks" className="button-secondary" style={{ marginTop: 24 }}>Browse Rulebooks</Link></div>}</section></AppShell>;
}
