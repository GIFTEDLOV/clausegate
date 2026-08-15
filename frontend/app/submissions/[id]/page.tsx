"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { TransactionProgress } from "@/components/TransactionProgress";
import { VerdictBadge } from "@/components/VerdictBadge";
import ClauseGate from "@/lib/contracts/ClauseGate";
import type { WriteStage } from "@/lib/contracts/types";
import { getContractAddress } from "@/lib/genlayer/client";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useCertificate, useRulebook, useSubmission } from "@/lib/hooks/useClauseGate";

const supportingCopy = {
  COMPLIANT: "This proposal was accepted against the published Rulebook.",
  NON_COMPLIANT: "This proposal did not satisfy the published Rulebook.",
  UNCLEAR: "Validators could not reach a defensible compliance decision from the submitted text.",
};

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const submission = useSubmission(id);
  const rulebook = useRulebook(submission.data?.rulebook_id || "");
  const certificate = useCertificate(id, submission.data?.verdict === "COMPLIANT");
  const { address, connectWallet } = useWallet();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<WriteStage | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function review() {
    setError("");
    const contractAddress = getContractAddress();
    if (!contractAddress) { setError("This app is not connected to a deployed ClauseGate contract yet."); return; }
    try {
      setStage("connecting");
      const wallet = address || await connectWallet();
      const result = await new ClauseGate(contractAddress, wallet).reviewSubmission(id, setStage);
      setHash(result.hash);
      await queryClient.invalidateQueries({ queryKey: ["clausegate", "submission", id] });
      await queryClient.invalidateQueries({ queryKey: ["clausegate", "submissions"] });
    } catch (reason) {
      setStage("error");
      setError(reason instanceof Error ? reason.message : "We couldn’t start this review. Please try again.");
    }
  }

  if (submission.isLoading) return <AppShell><section className="container py-20"><div className="skeleton h-8 w-72" /><div className="skeleton mt-8 h-80" /></section></AppShell>;
  if (submission.error || !submission.data) return <AppShell><section className="container py-20"><p className="eyebrow">Submission unavailable</p><h1 className="mt-3 text-3xl font-light">We couldn’t find this submission.</h1><Link href="/submissions" className="button-secondary mt-7">Back to Submissions</Link></section></AppShell>;
  const item = submission.data;
  const reviewed = item.status === "REVIEWED" && Boolean(item.verdict);
  const verdict = reviewed ? item.verdict : "";
  return <AppShell><section className="container py-12 sm:py-16"><Link href="/submissions" className="button-quiet"><ArrowLeft size={15} /> All Submissions</Link><div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start"><div><div className="flex flex-wrap items-center gap-3"><span className="eyebrow">Decision</span><VerdictBadge verdict={verdict} /></div><h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight tracking-[-0.06em] sm:text-6xl">{item.title}</h1>{reviewed ? <div className={`decision-panel decision-${item.verdict.toLowerCase()} mt-8 rounded-r-lg bg-white p-5 sm:p-6`}><p className="eyebrow">{item.verdict}</p><p className="mt-3 text-lg leading-7">{supportingCopy[item.verdict as keyof typeof supportingCopy]}</p></div> : <div className="surface mt-8 p-5 sm:p-6"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#f4e4da] text-accent">•</span><div><p className="font-semibold">Ready for review</p><p className="mt-1 text-sm leading-6 text-muted">Independent validators will evaluate this proposal against the Rulebook.</p></div></div></div>}<div className="mt-12"><p className="eyebrow">Exact proposal</p><div className="surface mt-4 p-6 sm:p-8"><p className="prose-content text-sm">{item.proposal_text}</p></div></div></div><aside className="space-y-4">{item.status === "SUBMITTED" && <div className="surface p-6"><p className="eyebrow">Next step</p><h2 className="mt-3 text-xl font-semibold tracking-[-0.03em]">Run compliance review</h2><p className="mt-3 text-sm leading-6 text-muted">The Rulebook and proposal are already committed. Start the consensus review when you’re ready.</p><button className="button-primary mt-6 w-full" onClick={() => void review()} disabled={stage === "sent" || stage === "confirming"}><ShieldCheck size={16} /> Run compliance review</button>{error && <div className="form-error mt-4">{error}</div>}<TransactionProgress stage={stage} hash={hash} /></div>}{item.status === "REVIEWED" && item.verdict === "COMPLIANT" && certificate.data && <div className="surface border-[#c9e3d3] bg-[#f5fbf7] p-6"><div className="flex items-center gap-2 text-[#21704b]"><CheckCircle2 size={18} /><p className="eyebrow text-[#21704b]">Approval certificate</p></div><p className="mt-4 text-sm leading-6">This certificate is queryable from the ClauseGate contract and binds the approved result to the published content.</p><details className="mt-5 border-t border-[#d8eadd] pt-4 text-xs text-muted"><summary className="cursor-pointer font-medium">Certificate details</summary><p className="mt-3 break-all font-mono">Digest: {certificate.data.result_digest}</p><p className="mt-2 font-mono">Verdict: {certificate.data.verdict}</p></details></div>}{rulebook.data && <div className="surface p-6"><p className="eyebrow">Evaluated against</p><Link href={`/rulebooks/${encodeURIComponent(item.rulebook_id)}`} className="mt-3 block font-semibold hover:text-accent">{rulebook.data.title} <ExternalLink size={14} className="ml-1 inline" /></Link><p className="mt-2 text-sm leading-6 text-muted">{rulebook.data.description}</p></div>}<details className="surface p-5 text-xs text-muted"><summary className="cursor-pointer font-medium">Technical details</summary><div className="mt-4 space-y-2 break-all font-mono"><p>Submission ID: {item.submission_id}</p><p>Rulebook ID: {item.rulebook_id}</p><p>Submitter: {item.submitter}</p>{item.result_digest && <p>Result digest: {item.result_digest}</p>}</div></details></aside></div></section></AppShell>;
}
