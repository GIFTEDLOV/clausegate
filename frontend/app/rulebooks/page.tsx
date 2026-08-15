"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useRulebooks } from "@/lib/hooks/useClauseGate";

export default function RulebooksPage() {
  const query = useRulebooks();
  return <AppShell><section className="container py-14 sm:py-20"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Published policies</p><h1 className="mt-3 text-4xl font-light tracking-[-0.06em] sm:text-5xl">Rulebooks</h1><p className="mt-4 max-w-xl text-muted">Each Rulebook is the fixed set of rules every proposal is evaluated against.</p></div><Link href="/rulebooks/new" className="button-primary"><Plus size={16} /> New Rulebook</Link></div>{query.isLoading ? <div className="mt-10 grid gap-4 md:grid-cols-2"><div className="skeleton h-48" /><div className="skeleton h-48" /></div> : query.error ? <div className="form-error mt-10">We couldn’t load Rulebooks right now. Please try again.</div> : query.data?.length ? <div className="mt-10 grid gap-4 md:grid-cols-2">{query.data.map((rulebook) => <Link key={rulebook.rulebook_id} href={`/rulebooks/${encodeURIComponent(rulebook.rulebook_id)}`} className="surface surface-hover p-6"><div className="flex items-start justify-between gap-4"><span className="eyebrow">Active Rulebook</span><ArrowRight size={17} className="text-muted" /></div><h2 className="mt-8 text-xl font-semibold tracking-[-0.03em]">{rulebook.title}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted">{rulebook.description}</p><p className="mt-8 text-xs text-muted">Published by <span className="font-mono">{rulebook.owner.slice(0, 8)}…</span></p></Link>)}</div> : <div className="surface mt-10 p-10 text-center"><h2 className="text-lg font-semibold">Your first Rulebook is waiting.</h2><p className="mt-2 text-sm text-muted">Publish a clear policy to start receiving proposals.</p><Link href="/rulebooks/new" className="button-primary mt-6">Create a Rulebook</Link></div>}</section></AppShell>;
}
