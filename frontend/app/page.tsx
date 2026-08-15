"use client";

import Link from "next/link";
import { ArrowRight, Check, FileText, Scale, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useRulebooks, useSubmissions } from "@/lib/hooks/useClauseGate";
import { getContractAddress } from "@/lib/genlayer/client";
import { VerdictBadge } from "@/components/VerdictBadge";

export default function HomePage() {
  const rulebooks = useRulebooks();
  const submissions = useSubmissions();
  const featured = rulebooks.data?.slice(0, 3) || [];

  return (
    <AppShell>
      <section className="container grid gap-12 pb-20 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-24">
        <div>
          <p className="eyebrow mb-5">Rules in. Decisions out.</p>
          <h1 className="max-w-[680px] text-5xl font-light leading-[.98] tracking-[-0.07em] sm:text-7xl">
            Make the rules clear.<br />
            <span className="text-muted">Let consensus enforce them.</span>
          </h1>
          <p className="mt-7 max-w-[560px] text-lg leading-8 text-muted">
            Publish a Rulebook, submit a proposal, and let independent GenLayer validators decide whether it complies.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/rulebooks/new" className="button-primary">Create a Rulebook <ArrowRight size={16} /></Link>
            <Link href="/rulebooks" className="button-secondary">Browse Rulebooks</Link>
          </div>
          {!getContractAddress() && (
            <p className="mt-6 max-w-md text-xs text-muted">Connect a deployed ClauseGate contract with <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> to load live data.</p>
          )}
        </div>
        <div className="surface overflow-hidden p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-line pb-5">
            <div><p className="eyebrow">A decision you can verify</p><p className="mt-2 text-xl font-semibold">One shared Rulebook</p></div>
            <Scale size={24} strokeWidth={1.5} className="text-accent" />
          </div>
          <div className="space-y-5 pt-6">
            {["Published rules stay fixed", "Proposal text is committed on-chain", "Only consensus can issue approval"].map((item) => (
              <div key={item} className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#e4f2e9] text-[#21704b]"><Check size={13} /></span><span className="text-sm">{item}</span></div>
            ))}
          </div>
          <div className="mt-8 rounded-lg bg-[#f7f7f4] p-4"><p className="eyebrow">Decision</p><div className="mt-3 flex items-center justify-between"><span className="text-2xl font-semibold tracking-[-0.04em]">COMPLIANT</span><VerdictBadge verdict="COMPLIANT" /></div></div>
        </div>
      </section>

      <section className="border-y border-line bg-white/45">
        <div className="container grid gap-8 py-10 sm:grid-cols-3">
          {[{ icon: FileText, title: "Write the rules", copy: "Turn a policy into one clear, published Rulebook." }, { icon: Scale, title: "Submit a proposal", copy: "Describe what you want evaluated against it." }, { icon: ShieldCheck, title: "Get a decision", copy: "Independent validators reach a strict, queryable result." }].map(({ icon: Icon, title, copy }, index) => (
            <div key={title} className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1eee8] text-accent">{index + 1}</span><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{copy}</p></div><Icon size={19} strokeWidth={1.5} className="ml-auto hidden text-muted sm:block" /></div>
          ))}
        </div>
      </section>

      <section className="container py-16">
        <div className="flex items-end justify-between gap-5"><div><p className="eyebrow">Live on-chain</p><h2 className="mt-2 text-3xl font-light tracking-[-0.05em]">Recent Rulebooks</h2></div><Link className="button-quiet" href="/rulebooks">View all <ArrowRight size={15} /></Link></div>
        {rulebooks.isLoading ? <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="skeleton h-44" /><div className="skeleton h-44" /><div className="skeleton h-44" /></div> : featured.length ? <div className="mt-7 grid gap-4 sm:grid-cols-3">{featured.map((rulebook) => <Link key={rulebook.rulebook_id} href={`/rulebooks/${encodeURIComponent(rulebook.rulebook_id)}`} className="surface surface-hover rulebook-card p-5"><p className="eyebrow">Active Rulebook</p><h3 className="mt-5 text-lg font-semibold tracking-[-0.025em]">{rulebook.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{rulebook.description}</p></Link>)}</div> : <div className="surface mt-7 p-8 text-center"><p className="font-medium">No Rulebooks published yet.</p><p className="mt-2 text-sm text-muted">Create the first one and make the rules clear.</p></div>}
        {submissions.data && <p className="mt-7 text-xs text-muted">{submissions.data.length} {submissions.data.length === 1 ? "submission" : "submissions"} recorded across published Rulebooks.</p>}
      </section>
    </AppShell>
  );
}
