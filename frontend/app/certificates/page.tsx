"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useCertificates } from "@/lib/hooks/useClauseGate";

export default function CertificatesPage() {
  const query = useCertificates();
  const columns = { gridTemplateColumns: "1.2fr 1fr 1.45fr auto" };
  const errorMessage = query.error instanceof Error ? query.error.message : "We couldn&apos;t load certificates right now. Please try again.";

  return <AppShell><section className="container app-main"><div className="page-header"><div><p className="eyebrow">Evidence-bound approval</p><h1 className="page-title">Certificates</h1><p className="page-description">Only actual v2 certificates are listed here. Each binds submitted evidence references, the consensus assessment, and the final result digest.</p></div></div>{query.isLoading ? <div className="registry"><div className="skeleton" style={{ height: 118 }} /><div className="skeleton" style={{ height: 118, marginTop: 12 }} /></div> : query.error ? <div className="form-error" style={{ marginTop: 30 }}>{errorMessage}</div> : query.data.length ? <div className="registry" aria-label="Evidence-bound approval certificates"><div className="registry-header" style={columns}><span>Certificate</span><span>Rulebook</span><span>Result digest</span><span>Action</span></div>{query.data.map(({ submission, certificate }) => <Link key={submission.submission_id} href={`/submissions/${encodeURIComponent(submission.submission_id)}`} className="registry-row" style={columns}><div><div className="registry-primary">{submission.title}</div><div className="registry-secondary"><span className="status-badge status-compliant">EVIDENCE-BOUND APPROVAL</span></div></div><div className="registry-cell font-mono">{certificate.rulebook_id}</div><div className="registry-cell font-mono hash-wrap">{certificate.result_digest}<br /><span style={{ color: "var(--muted)" }}>Certificate v2 · {certificate.evidence_count} source{certificate.evidence_count === 1 ? "" : "s"}</span></div><span className="registry-action">View certificate <ArrowRight size={14} /></span></Link>)}</div> : <div className="empty-state"><h2>No v2 approval certificates found.</h2><p className="muted" style={{ marginTop: 8 }}>Historical v1 claim-based certificates are not represented as evidence-bound approvals.</p><Link href="/decisions" className="button-secondary" style={{ marginTop: 24 }}>Browse decisions</Link></div>}</section></AppShell>;
}
