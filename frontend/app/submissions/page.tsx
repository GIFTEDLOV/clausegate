"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { VerdictBadge } from "@/components/VerdictBadge";
import { useSubmissions } from "@/lib/hooks/useClauseGate";

export default function SubmissionsPage() {
  const query = useSubmissions();
  return <AppShell><section className="container py-14 sm:py-20"><p className="eyebrow">On-chain proposals</p><h1 className="mt-3 text-4xl font-light tracking-[-0.06em] sm:text-5xl">Submissions</h1><p className="mt-4 max-w-xl text-muted">Browse proposals and see whether a Rulebook review has reached a terminal decision.</p>{query.isLoading ? <div className="mt-10 space-y-3"><div className="skeleton h-24" /><div className="skeleton h-24" /><div className="skeleton h-24" /></div> : query.error ? <div className="form-error mt-10">We couldn’t load submissions right now. Please try again.</div> : query.data?.length ? <div className="mt-10 space-y-3">{query.data.map((submission) => <Link key={submission.submission_id} href={`/submissions/${encodeURIComponent(submission.submission_id)}`} className="surface surface-hover flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><VerdictBadge verdict={submission.verdict} /><span className="text-xs text-muted">{submission.rulebook_id}</span></div><h2 className="mt-3 truncate font-semibold">{submission.title}</h2><p className="mt-1 truncate text-sm text-muted">{submission.proposal_text}</p></div><ArrowRight size={17} className="shrink-0 text-muted" /></Link>)}</div> : <div className="surface mt-10 p-10 text-center"><h2 className="text-lg font-semibold">No submissions yet.</h2><p className="mt-2 text-sm text-muted">Choose a Rulebook to submit the first proposal.</p><Link href="/rulebooks" className="button-secondary mt-6">Browse Rulebooks</Link></div>}</section></AppShell>;
}
