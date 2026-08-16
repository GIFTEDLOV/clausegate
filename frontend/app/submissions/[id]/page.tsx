"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { TransactionProgress } from "@/components/TransactionProgress";
import ClauseGate from "@/lib/contracts/ClauseGate";
import type { WriteStage } from "@/lib/contracts/types";
import { contractExplorerUrl } from "@/lib/genlayer/explorer";
import { getContractAddress } from "@/lib/genlayer/client";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useCertificate, useRulebook, useSubmission } from "@/lib/hooks/useClauseGate";

const CONTRACT = "0x49446d1e225Ba9821d38457DcdCAb31b2170c061";
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
      setError(reason instanceof Error ? reason.message : "We couldn&apos;t start this review. Please try again.");
    }
  }

  if (submission.isLoading) return <AppShell><section className="container app-main"><div className="skeleton" style={{ height: 40, width: 300 }} /><div className="skeleton" style={{ height: 320, marginTop: 32 }} /></section></AppShell>;
  if (submission.error || !submission.data) return <AppShell><section className="container app-main"><p className="eyebrow">Submission unavailable</p><h1 className="page-title">We couldn&apos;t find this submission.</h1><Link href="/submissions" className="button-secondary" style={{ marginTop: 28 }}>Back to Submissions</Link></section></AppShell>;

  const item = submission.data;
  const reviewed = item.status === "REVIEWED" && Boolean(item.verdict);
  return <AppShell><section className="container app-main"><Link href="/submissions" className="button-quiet"><ArrowLeft size={15} /> All Submissions</Link><div className={`decision-layout decision-${item.verdict?.toLowerCase() || "pending"}`} style={{ marginTop: 48 }}><div><p className="decision-kicker">DECISION / {item.status}</p><h1 className="decision-word">{reviewed ? item.verdict : "SUBMITTED"}</h1><p className="decision-summary">{reviewed ? supportingCopy[item.verdict as keyof typeof supportingCopy] : "This proposal is committed and ready for an independent compliance review."}</p><div className="document-wrap"><div className="document-heading"><h2 className="eyebrow">Exact proposal</h2></div><div className="document"><p className="prose-content">{item.proposal_text}</p></div></div></div><aside className="decision-rail">{item.status === "SUBMITTED" && <div className="form-surface"><p className="eyebrow">Next step</p><h2 style={{ marginTop: 13, fontSize: "1.25rem", letterSpacing: "-.04em" }}>Run compliance review</h2><p className="muted" style={{ marginTop: 12, fontSize: ".8rem", lineHeight: 1.6 }}>The Rulebook and proposal are already committed. Start the consensus review when you&apos;re ready.</p><button className="button-primary" style={{ width: "100%", marginTop: 24 }} onClick={() => void review()} disabled={stage === "sent" || stage === "confirming"}><ShieldCheck size={16} /> Run compliance review</button>{error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}<TransactionProgress stage={stage} hash={hash} /></div>}{item.status === "REVIEWED" && item.verdict === "COMPLIANT" && certificate.data && <div className="certificate-panel"><div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--compliant)" }}><CheckCircle2 size={18} /><p className="eyebrow" style={{ color: "var(--compliant)" }}>Approval certificate</p></div><h2>Certificate</h2><p style={{ marginTop: 13, color: "#234b38", fontSize: ".8rem", lineHeight: 1.6 }}>Issued for a finalized compliant decision and queryable from the ClauseGate contract.</p><dl><div className="certificate-row"><dt>Verdict</dt><dd>{certificate.data.verdict}</dd></div><div className="certificate-row"><dt>Digest</dt><dd>{certificate.data.result_digest}</dd></div><div className="certificate-row"><dt>Submission ID</dt><dd>{item.submission_id}</dd></div><div className="certificate-row"><dt>Rulebook ID</dt><dd>{item.rulebook_id}</dd></div></dl></div>}{rulebook.data && <div className="technical-panel"><dl className="metadata-strip"><div className="metadata-item"><dt>Evaluated against</dt><dd><Link href={`/rulebooks/${encodeURIComponent(item.rulebook_id)}`}>{rulebook.data.title} <ArrowUpRight size={13} style={{ display: "inline" }} /></Link></dd></div><div className="metadata-item"><dt>Network</dt><dd>GenLayer Bradbury</dd></div><div className="metadata-item"><dt>Production contract</dt><dd className="font-mono">{CONTRACT}</dd></div><div className="metadata-item"><dt>Submission ID</dt><dd className="font-mono">{item.submission_id}</dd></div><div className="metadata-item"><dt>Submitter</dt><dd className="font-mono">{item.submitter}</dd></div>{item.result_digest && <div className="metadata-item"><dt>Result digest</dt><dd className="font-mono">{item.result_digest}</dd></div>}</dl><a href={contractExplorerUrl(CONTRACT)} target="_blank" rel="noreferrer" className="technical-actions">View contract <ArrowUpRight size={14} /></a></div>}</aside></div></section></AppShell>;
}
