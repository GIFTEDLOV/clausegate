"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { TransactionProgress } from "@/components/TransactionProgress";
import ClauseGate from "@/lib/contracts/ClauseGate";
import type { WriteStage } from "@/lib/contracts/types";
import { getContractAddress } from "@/lib/genlayer/client";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useRulebook } from "@/lib/hooks/useClauseGate";

function clientId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

export default function SubmitProposalPage() {
  const params = useParams<{ id: string }>();
  const rulebookId = decodeURIComponent(params.id);
  const rulebook = useRulebook(rulebookId);
  const router = useRouter();
  const { address, connectWallet } = useWallet();
  const [form, setForm] = useState({ title: "", proposal: "" });
  const [stage, setStage] = useState<WriteStage | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!form.title.trim() || !form.proposal.trim()) { setError("Add a title and proposal before submitting."); return; }
    const contractAddress = getContractAddress();
    if (!contractAddress) { setError("This app is not connected to a deployed ClauseGate contract yet."); return; }
    try {
      setStage("connecting");
      const wallet = address || await connectWallet();
      const id = clientId("submission");
      const result = await new ClauseGate(contractAddress, wallet).submitProposal(id, rulebookId, form.title, form.proposal, setStage);
      setHash(result.hash);
      router.push(`/submissions/${encodeURIComponent(id)}`);
    } catch (reason) {
      setStage("error");
      setError(reason instanceof Error ? reason.message : "We couldn’t submit this proposal. Please try again.");
    }
  }

  if (rulebook.isLoading) return <AppShell><section className="container py-20"><div className="skeleton h-8 w-72" /><div className="skeleton mt-5 h-32" /></section></AppShell>;
  if (rulebook.error || !rulebook.data) return <AppShell><section className="container py-20"><p className="form-error">This Rulebook could not be found.</p></section></AppShell>;
  return <AppShell><section className="container max-w-3xl py-14 sm:py-20"><p className="eyebrow">Submit against</p><h1 className="mt-3 text-4xl font-light tracking-[-0.06em] sm:text-5xl">{rulebook.data.title}</h1><p className="mt-4 text-muted">Describe the submission the way you want it evaluated against the Rulebook.</p><form onSubmit={submit} className="surface mt-10 space-y-7 p-6 sm:p-8"><div><label className="form-label" htmlFor="proposal-title">Title</label><input id="proposal-title" className="input-field" placeholder="Open-source expense sharing app" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} /></div><div><label className="form-label" htmlFor="proposal">Proposal</label><textarea id="proposal" className="textarea-field" placeholder="Describe the submission the way you want it evaluated against the Rulebook." value={form.proposal} onChange={(e) => setForm({ ...form, proposal: e.target.value })} maxLength={16000} /><p className="form-help">No external evidence links are required in this version. Keep the proposal focused on the published rules.</p></div>{error && <div className="form-error">{error}</div>}<TransactionProgress stage={stage} hash={hash} /><div className="flex flex-col-reverse justify-between gap-3 border-t border-line pt-6 sm:flex-row sm:items-center"><p className="text-xs text-muted">Submission received · waiting for network confirmation</p><button className="button-primary" type="submit" disabled={stage === "sent" || stage === "confirming"}>Submit proposal</button></div></form></section></AppShell>;
}
