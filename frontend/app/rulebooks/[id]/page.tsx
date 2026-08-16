"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { useParams } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { useRulebook } from "@/lib/hooks/useClauseGate";

export default function RulebookDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const query = useRulebook(id);
  if (query.isLoading) return <AppShell><section className="container app-main"><div className="skeleton" style={{ height: 40, width: 280 }} /><div className="skeleton" style={{ height: 20, width: 500, maxWidth: "100%", marginTop: 20 }} /><div className="skeleton" style={{ height: 300, marginTop: 48 }} /></section></AppShell>;
  if (query.error || !query.data) return <AppShell><section className="container app-main"><p className="eyebrow">Rulebook unavailable</p><h1 className="page-title">We couldn&apos;t find this Rulebook.</h1><Link href="/rulebooks" className="button-secondary" style={{ marginTop: 28 }}>Back to Rulebooks</Link></section></AppShell>;
  const rulebook = query.data;
  return <AppShell><section className="container app-main"><Link href="/rulebooks" className="button-quiet"><ArrowLeft size={15} /> All Rulebooks</Link><div className="rulebook-layout" style={{ marginTop: 48 }}><div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="status-dot status-dot-good" /><span className="eyebrow">Active Rulebook</span></div><h1 className="page-title">{rulebook.title}</h1><p className="rulebook-description">{rulebook.description}</p><div className="document-wrap"><div className="document-heading"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><FileText size={17} /><h2 className="eyebrow">Published rules</h2></div></div><div className="document"><p className="prose-content">{rulebook.rules}</p></div></div></div><aside className="decision-rail"><div className="technical-panel"><dl className="metadata-strip"><div className="metadata-item"><dt>Status</dt><dd>Active</dd></div><div className="metadata-item"><dt>Rulebook ID</dt><dd className="font-mono">{rulebook.rulebook_id}</dd></div><div className="metadata-item"><dt>Owner</dt><dd className="font-mono">{rulebook.owner}</dd></div></dl></div><div className="form-surface"><p className="eyebrow">Ready to submit?</p><h2 style={{ marginTop: 13, fontSize: "1.25rem", letterSpacing: "-.04em" }}>Make a proposal against these rules.</h2><p className="muted" style={{ marginTop: 12, fontSize: ".8rem", lineHeight: 1.6 }}>Your exact proposal text will be committed to contract state before review.</p><Link href={`/rulebooks/${encodeURIComponent(id)}/submit`} className="button-primary" style={{ width: "100%", marginTop: 24 }}>Submit a Proposal <ArrowRight size={16} /></Link></div></aside></div></section></AppShell>;
}
