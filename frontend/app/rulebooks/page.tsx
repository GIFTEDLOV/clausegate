"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useRulebooks } from "@/lib/hooks/useClauseGate";

export default function RulebooksPage() {
  const query = useRulebooks();
  return <AppShell><section className="container app-main"><div className="page-header"><div><p className="eyebrow">Published requirements</p><h1 className="page-title">Rulebooks</h1><p className="page-description">Published requirements available for proposal review. Every decision starts with a clear, shared source of truth.</p></div><Link href="/rulebooks/new" className="button-primary"><Plus size={16} /> Create Rulebook</Link></div>{query.isLoading ? <div className="registry"><div className="skeleton" style={{ height: 100 }} /><div className="skeleton" style={{ height: 100, marginTop: 12 }} /></div> : query.error ? <div className="form-error" style={{ marginTop: 30 }}>We couldn&apos;t load Rulebooks right now. Please try again.</div> : query.data?.length ? <div className="registry" aria-label="Published Rulebooks"><div className="registry-header"><span>Rulebook</span><span>Description</span><span>Owner</span><span>Status</span><span>Action</span></div>{query.data.map((rulebook) => <Link key={rulebook.rulebook_id} href={`/rulebooks/${encodeURIComponent(rulebook.rulebook_id)}`} className="registry-row"><div><div className="registry-primary">{rulebook.title}</div><div className="registry-secondary font-mono">{rulebook.rulebook_id}</div></div><div className="registry-cell">{rulebook.description}</div><div className="registry-cell font-mono">{rulebook.owner.slice(0, 8)}…</div><div className="registry-cell"><span className="status-badge status-compliant">ACTIVE</span></div><span className="registry-action">View <ArrowRight size={14} /></span></Link>)}</div> : <div className="empty-state"><h2>Publish the first Rulebook.</h2><p className="muted" style={{ marginTop: 8 }}>Create a clear policy to start receiving proposals.</p><Link href="/rulebooks/new" className="button-primary" style={{ marginTop: 24 }}>Create Rulebook</Link></div>}</section></AppShell>;
}
