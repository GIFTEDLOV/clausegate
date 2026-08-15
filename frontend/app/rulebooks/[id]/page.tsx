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
  if (query.isLoading) return <AppShell><section className="container py-20"><div className="skeleton h-8 w-64" /><div className="skeleton mt-5 h-5 w-96 max-w-full" /><div className="skeleton mt-12 h-72" /></section></AppShell>;
  if (query.error || !query.data) return <AppShell><section className="container py-20"><p className="eyebrow">Rulebook unavailable</p><h1 className="mt-3 text-3xl font-light">We couldn’t find this Rulebook.</h1><Link href="/rulebooks" className="button-secondary mt-7">Back to Rulebooks</Link></section></AppShell>;
  const rulebook = query.data;
  return <AppShell><section className="container py-12 sm:py-16"><Link href="/rulebooks" className="button-quiet"><ArrowLeft size={15} /> All Rulebooks</Link><div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px] lg:items-start"><div><div className="flex items-center gap-3"><span className="status-dot status-dot-good" /><span className="eyebrow">Active Rulebook</span></div><h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight tracking-[-0.06em] sm:text-6xl">{rulebook.title}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-muted">{rulebook.description}</p><div className="mt-12"><div className="flex items-center gap-3"><FileText size={18} className="text-accent" /><h2 className="font-semibold">Published rules</h2></div><div className="surface mt-4 p-6 sm:p-8"><p className="prose-content text-sm">{rulebook.rules}</p></div></div></div><aside className="surface p-6 lg:sticky lg:top-24"><p className="eyebrow">Ready to submit?</p><h2 className="mt-3 text-xl font-semibold tracking-[-0.03em]">Make a proposal against these rules.</h2><p className="mt-3 text-sm leading-6 text-muted">Your exact proposal text will be committed to contract state before review.</p><Link href={`/rulebooks/${encodeURIComponent(id)}/submit`} className="button-primary mt-6 w-full">Submit proposal <ArrowRight size={16} /></Link><details className="mt-7 border-t border-line pt-4 text-xs text-muted"><summary className="cursor-pointer font-medium">Technical details</summary><p className="mt-3 break-all font-mono">Rulebook ID: {rulebook.rulebook_id}</p><p className="mt-2 break-all font-mono">Owner: {rulebook.owner}</p></details></aside></div></section></AppShell>;
}
