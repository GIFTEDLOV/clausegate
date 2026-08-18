"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TransactionProgress } from "@/components/TransactionProgress";
import ClauseGate from "@/lib/contracts/ClauseGate";
import type { EvidenceReference, EvidenceType, WriteStage } from "@/lib/contracts/types";
import { getContractAddress, getContractVersion } from "@/lib/genlayer/client";
import { canonicalizeEvidence, controlAttestation, controlLocation, recomputeEvidenceCommitment } from "@/lib/genlayer/digest";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useRulebook } from "@/lib/hooks/useClauseGate";

function clientId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

const emptyEvidence = (): EvidenceReference => ({ type: "WEB_PAGE", url: "", claim: "" });

export default function SubmitProposalPage() {
  const params = useParams<{ id: string }>();
  const rulebookId = decodeURIComponent(params.id);
  const rulebook = useRulebook(rulebookId);
  const router = useRouter();
  const { address, connectWallet } = useWallet();
  const version = getContractVersion();
  const [submissionId] = useState(() => clientId("submission"));
  const [form, setForm] = useState({ title: "", proposal: "", evidence: [emptyEvidence()] });
  const [proofs, setProofs] = useState<Array<{ source: EvidenceReference; json: string; location: string }>>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [stage, setStage] = useState<WriteStage | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function prepareProofs() {
      if (version !== "2" || !address) { setProofs([]); return; }
      const sources = form.evidence.map((item) => ({ ...item, url: item.url.trim(), claim: item.claim.trim() })).filter((item) => item.url && item.claim);
      try {
        const canonical = canonicalizeEvidence(sources);
        const commitment = await recomputeEvidenceCommitment(canonical);
        const next = await Promise.all(canonical.map(async (source) => ({
          source,
          location: controlLocation(source),
          json: JSON.stringify(await controlAttestation(submissionId, rulebookId, address, source.url, commitment), null, 2),
        })));
        if (!cancelled) setProofs(next);
      } catch {
        if (!cancelled) setProofs([]);
      }
    }
    void prepareProofs();
    return () => { cancelled = true; };
  }, [address, form.evidence, rulebookId, submissionId, version]);

  function updateEvidence(index: number, field: keyof EvidenceReference, value: string) {
    setForm((current) => ({
      ...current,
      evidence: current.evidence.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  }

  function addEvidence() {
    if (form.evidence.length < 4) setForm((current) => ({ ...current, evidence: [...current.evidence, emptyEvidence()] }));
  }

  function removeEvidence(index: number) {
    setForm((current) => ({ ...current, evidence: current.evidence.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function copyProof(index: number, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(index);
    window.setTimeout(() => setCopied((current) => current === index ? null : current), 1600);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const evidence = form.evidence.map((item) => ({ ...item, url: item.url.trim(), claim: item.claim.trim() })).filter((item) => item.url || item.claim);
    if (!form.title.trim() || !form.proposal.trim()) { setError("Add a title and proposal before submitting."); return; }
    if (version === "2" && (evidence.length < 1 || evidence.length > 4 || evidence.some((item) => !item.url || !item.claim))) {
      setError("Evidence-bound v2 reviews require 1–4 complete evidence items."); return;
    }
    if (version === "1" && evidence.length) {
      setError("This environment is configured for the historical v1 interface and cannot accept evidence references. Use the reviewed v2 contract configuration."); return;
    }
    let canonicalEvidence: EvidenceReference[];
    try { canonicalEvidence = canonicalizeEvidence(evidence); }
    catch { setError("Evidence URLs must be valid HTTPS references."); return; }
    const contractAddress = getContractAddress();
    if (!contractAddress) { setError("This app is not connected to a deployed ClauseGate contract yet."); return; }
    try {
      setStage("connecting");
      const wallet = address || await connectWallet();
      const result = await new ClauseGate(contractAddress, wallet).submitProposal(submissionId, rulebookId, form.title, form.proposal, canonicalEvidence, setStage);
      setHash(result.hash);
      router.push(`/submissions/${encodeURIComponent(submissionId)}`);
    } catch (reason) {
      setStage("error");
      setError(reason instanceof Error ? reason.message : "We couldn&apos;t submit this proposal. Please try again.");
    }
  }

  if (rulebook.isLoading) return <AppShell><section className="container app-main"><div className="skeleton" style={{ height: 40, width: 300 }} /><div className="skeleton" style={{ height: 150, marginTop: 28 }} /></section></AppShell>;
  if (rulebook.error || !rulebook.data) return <AppShell><section className="container app-main"><p className="form-error">This Rulebook could not be found.</p></section></AppShell>;

  return <AppShell><section className="container app-main"><div className="form-layout">
    <div className="form-intro"><p className="eyebrow">Evidence-aware submission workflow</p><h1 className="page-title">Submit for review.</h1><p>You are submitting against <strong>{rulebook.data.title}</strong>. Describe the submission the way you want it evaluated against the Rulebook.</p><p className="form-help" style={{ marginTop: 22 }}>ClauseGate validators independently retrieve these sources during review. Your written proposal is not treated as factual proof on its own.</p><p className="font-mono" style={{ marginTop: 32, color: "var(--muted)", fontSize: ".68rem", lineHeight: 1.6 }}>RULEBOOK / {rulebookId}</p></div>
    <form onSubmit={submit} className="form-surface"><div className="form-section">
      <div className="form-field"><label className="form-label" htmlFor="proposal-title">Title</label><input id="proposal-title" className="input-field" placeholder="Open-source expense sharing app" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} /></div>
      <div className="form-field"><label className="form-label" htmlFor="proposal">Proposal</label><textarea id="proposal" className="textarea-field" placeholder="Describe the submission the way you want it evaluated against the Rulebook." value={form.proposal} onChange={(e) => setForm({ ...form, proposal: e.target.value })} maxLength={16000} /><p className="form-help">Proposal claims are evaluated against the Rulebook, but do not establish external facts without evidence.</p></div>
      <fieldset className="evidence-fieldset"><legend className="form-label">Evidence</legend><p className="form-help" style={{ marginTop: 0 }}>Evidence-bound v2 reviews accept 1–4 HTTPS sources. Each validator retrieves the committed references independently.</p>{form.evidence.map((item, index) => <div className="evidence-editor" key={`${index}-${item.type}`}><div className="evidence-editor-head"><span className="eyebrow">SOURCE {String(index + 1).padStart(2, "0")}</span>{form.evidence.length > 1 && <button className="button-quiet" type="button" onClick={() => removeEvidence(index)} aria-label={`Remove evidence source ${index + 1}`}><Trash2 size={14} /> Remove</button>}</div><label className="form-label" htmlFor={`evidence-type-${index}`}>Evidence type</label><select id={`evidence-type-${index}`} className="input-field" value={item.type} onChange={(e) => updateEvidence(index, "type", e.target.value as EvidenceType)}><option value="GITHUB_REPOSITORY">GitHub repository</option><option value="WEB_PAGE">Web page</option></select><label className="form-label" htmlFor={`evidence-url-${index}`}>URL</label><input id={`evidence-url-${index}`} className="input-field" placeholder={item.type === "GITHUB_REPOSITORY" ? "https://github.com/owner/repository" : "https://example.com/demo"} value={item.url} onChange={(e) => updateEvidence(index, "url", e.target.value)} maxLength={500} /><label className="form-label" htmlFor={`evidence-claim-${index}`}>Claim this source establishes</label><textarea id={`evidence-claim-${index}`} className="textarea-field evidence-claim" placeholder="The project&apos;s source repository is publicly accessible under an MIT license." value={item.claim} onChange={(e) => updateEvidence(index, "claim", e.target.value)} maxLength={1000} /></div>)}{form.evidence.length < 4 && <button type="button" className="button-secondary" onClick={addEvidence}><Plus size={15} /> Add evidence source</button>}<p className="form-help">HTTPS only. GitHub sources must use https://github.com/owner/repository. The external source remains mutable; the certificate binds the submitted reference and consensus assessment at review time.</p></fieldset>
      {version === "2" && <section className="control-proof-panel" aria-label="Source control attestation"><p className="eyebrow">Proof of control</p><h2 style={{ marginTop: 10, fontSize: "1.15rem" }}>Publish one attestation per source</h2><p className="form-help" style={{ marginTop: 10 }}>ClauseGate validators independently retrieve this control file to verify that the submitted evidence source is intentionally bound to this wallet and submission. This is proof of source control, not legal ownership.</p>{!address && <p className="form-help" style={{ marginTop: 12 }}>Connect your wallet to generate the exact attestation contents.</p>}{proofs.map((proof, index) => <div className="control-proof" key={`${proof.source.url}-${index}`}><div><p className="eyebrow">{proof.source.type === "GITHUB_REPOSITORY" ? "GITHUB CONTROL FILE" : "WEB CONTROL FILE"}</p><p className="form-help" style={{ marginTop: 7 }}>{proof.source.type === "GITHUB_REPOSITORY" ? "Add this file to .well-known/clausegate.json on the repository&apos;s default branch." : `Publish this file at ${proof.location}`}</p></div><pre className="control-proof-json">{proof.json}</pre><button type="button" className="button-secondary" onClick={() => void copyProof(index, proof.json)}><Copy size={14} /> {copied === index ? "Copied" : "Copy control JSON"}</button></div>)}</section>}
      {version === "1" && <div className="form-error">This environment is configured for the historical v1 claim-based interface. Evidence-bound certificates require the reviewed v2 contract.</div>}
      {error && <div className="form-error">{error}</div>}<TransactionProgress stage={stage} hash={hash} /><div className="form-actions"><p className="muted" style={{ flex: 1, fontSize: ".72rem" }}>Submission received · waiting for network confirmation</p><button className="button-primary" type="submit" disabled={stage === "sent" || stage === "confirming"}>Commit Submission</button></div>
    </div></form>
  </div></section></AppShell>;
}
