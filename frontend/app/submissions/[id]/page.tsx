"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { TransactionProgress } from "@/components/TransactionProgress";
import ClauseGate from "@/lib/contracts/ClauseGate";
import type { EvidenceAssessmentStatus, WriteStage } from "@/lib/contracts/types";
import { contractExplorerUrl } from "@/lib/genlayer/explorer";
import { DEPLOYMENT } from "@/lib/config/deployment";
import { getContractAddress } from "@/lib/genlayer/client";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useCertificate, useRulebook, useSubmission } from "@/lib/hooks/useClauseGate";

const supportingCopy = {
  COMPLIANT: "This proposal was accepted against the published Rulebook and its committed evidence references.",
  NON_COMPLIANT: "This proposal did not satisfy the published Rulebook or a material requirement was contradicted by evidence.",
  UNCLEAR: "Validators could not reach a defensible compliance decision from the committed inputs and evidence.",
};
const CONTRACT = DEPLOYMENT.contractAddress;
const assessmentLabels = ["SUPPORTED", "CONTRADICTED", "INSUFFICIENT"] as const;

function assessmentClass(status: EvidenceAssessmentStatus | "PENDING") {
  return status === "PENDING" ? "status-pending" : assessmentLabels.includes(status) ? `status-${status.toLowerCase()}` : "status-pending";
}

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
      await queryClient.invalidateQueries({ queryKey: ["clausegate", "certificate", id] });
    } catch (reason) {
      setStage("error");
      setError(reason instanceof Error ? reason.message : "We couldn&apos;t start this review. Please try again.");
    }
  }

  if (submission.isLoading) return <AppShell><section className="container app-main"><div className="skeleton" style={{ height: 40, width: 300 }} /><div className="skeleton" style={{ height: 320, marginTop: 32 }} /></section></AppShell>;
  if (submission.error || !submission.data) return <AppShell><section className="container app-main"><p className="eyebrow">Submission unavailable</p><h1 className="page-title">We couldn&apos;t find this submission.</h1><Link href="/submissions" className="button-secondary" style={{ marginTop: 28 }}>Back to Submissions</Link></section></AppShell>;

  const item = submission.data;
  const reviewed = item.status === "REVIEWED" && Boolean(item.verdict);
  const assessment = new Map((item.evidence_assessment || []).map((entry) => [entry.index, entry.status]));
  const v2Certificate = certificate.data?.certificate_version === "2" ? certificate.data : null;
  return <AppShell><section className="container app-main"><Link href="/submissions" className="button-quiet"><ArrowLeft size={15} /> All Submissions</Link><div className={`decision-layout decision-${item.verdict?.toLowerCase() || "pending"}`} style={{ marginTop: 48 }}><div><p className="decision-kicker">DECISION / {item.status}</p><h1 className="decision-word">{reviewed ? item.verdict : "SUBMITTED"}</h1><p className="decision-summary">{reviewed ? supportingCopy[item.verdict as keyof typeof supportingCopy] : "This proposal is committed and ready for an independent evidence-aware compliance review."}</p><div className="document-wrap"><div className="document-heading"><h2 className="eyebrow">Exact proposal</h2></div><div className="document"><p className="prose-content">{item.proposal_text}</p></div></div><div className="document-wrap"><div className="document-heading"><h2 className="eyebrow">Evidence</h2><span className="muted" style={{ fontSize: ".72rem" }}>{item.evidence?.length || 0} committed source{item.evidence?.length === 1 ? "" : "s"}</span></div>{item.evidence?.length ? <div className="evidence-list">{item.evidence.map((source, index) => <article className="evidence-card" key={`${source.url}-${index}`}><div className="evidence-card-head"><span className="eyebrow">{source.type === "GITHUB_REPOSITORY" ? "GITHUB REPOSITORY" : "WEB PAGE"}</span><span className={`status-badge ${assessmentClass(assessment.get(index) || "PENDING")}`}>{assessment.get(index) || "PENDING"}</span></div><p className="evidence-claim">{source.claim}</p><a className="evidence-url font-mono" href={source.url} target="_blank" rel="noreferrer">{source.url}</a></article>)}</div> : <div className="empty-state" style={{ marginTop: 16, padding: 28 }}><p className="muted">No evidence references were committed. This submission cannot receive an evidence-bound COMPLIANT certificate.</p></div>}</div></div><aside className="decision-rail">{item.status === "SUBMITTED" && <div className="form-surface"><p className="eyebrow">Next step</p><h2 style={{ marginTop: 13, fontSize: "1.25rem", letterSpacing: "-.04em" }}>Run compliance review</h2><p className="muted" style={{ marginTop: 12, fontSize: ".8rem", lineHeight: 1.6 }}>Validators independently retrieve each committed source and compare the compact evidence assessment through consensus.</p><button className="button-primary" style={{ width: "100%", marginTop: 24 }} onClick={() => void review()} disabled={stage === "sent" || stage === "confirming"}><ShieldCheck size={16} /> Run compliance review</button>{error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}<TransactionProgress stage={stage} hash={hash} /></div>}{item.status === "REVIEWED" && item.verdict === "COMPLIANT" && v2Certificate && <div className="certificate-panel"><div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--compliant)" }}><CheckCircle2 size={18} /><p className="eyebrow" style={{ color: "var(--compliant)" }}>Evidence-bound approval</p></div><h2>Certificate v2</h2><p style={{ marginTop: 13, color: "#234b38", fontSize: ".8rem", lineHeight: 1.6 }}>Issued only after validators independently retrieved the committed evidence references and reached consensus on the assessment.</p><dl><div className="certificate-row"><dt>Verdict</dt><dd>{v2Certificate.verdict}</dd></div><div className="certificate-row"><dt>Evidence commitment</dt><dd>{v2Certificate.evidence_commitment}</dd></div><div className="certificate-row"><dt>Assessment digest</dt><dd>{v2Certificate.evidence_assessment_digest}</dd></div><div className="certificate-row"><dt>Result digest</dt><dd>{v2Certificate.result_digest}</dd></div><div className="certificate-row"><dt>Evidence count</dt><dd>{v2Certificate.evidence_count}</dd></div></dl></div>}{item.status === "REVIEWED" && item.verdict === "COMPLIANT" && certificate.data?.certificate_version === "1" && <div className="certificate-panel" style={{ borderColor: "var(--hairline)", background: "var(--canvas)" }}><p className="eyebrow">Historical v1 claim-based certificate</p><h2>Certificate v1</h2><p className="muted" style={{ marginTop: 13, fontSize: ".8rem", lineHeight: 1.6 }}>This preserved production certificate predates evidence-bound v2 and represents consensus interpretation of committed proposal claims.</p><dl><div className="certificate-row"><dt>Result digest</dt><dd>{certificate.data.result_digest}</dd></div></dl></div>}{rulebook.data && <div className="technical-panel"><dl className="metadata-strip"><div className="metadata-item"><dt>Evaluated against</dt><dd><Link href={`/rulebooks/${encodeURIComponent(item.rulebook_id)}`}>{rulebook.data.title} <ArrowUpRight size={13} style={{ display: "inline" }} /></Link></dd></div><div className="metadata-item"><dt>Network</dt><dd>GenLayer Bradbury</dd></div><div className="metadata-item"><dt>Production contract</dt><dd className="font-mono">{CONTRACT}</dd></div><div className="metadata-item"><dt>Submission ID</dt><dd className="font-mono">{item.submission_id}</dd></div><div className="metadata-item"><dt>Submitter</dt><dd className="font-mono">{item.submitter}</dd></div>{item.evidence_commitment && <div className="metadata-item"><dt>Evidence commitment</dt><dd className="font-mono">{item.evidence_commitment}</dd></div>}{item.result_digest && <div className="metadata-item"><dt>Result digest</dt><dd className="font-mono">{item.result_digest}</dd></div>}</dl><a href={contractExplorerUrl(CONTRACT)} target="_blank" rel="noreferrer" className="technical-actions">View contract <ArrowUpRight size={14} /></a></div>}</aside></div></section></AppShell>;
}
