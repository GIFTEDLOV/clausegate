"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { TransactionProgress } from "@/components/TransactionProgress";
import ClauseGate from "@/lib/contracts/ClauseGate";
import type { WriteStage } from "@/lib/contracts/types";
import { getContractAddress } from "@/lib/genlayer/client";
import { useWallet } from "@/lib/genlayer/WalletProvider";

function clientId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

export default function NewRulebookPage() {
  const router = useRouter();
  const { address, connectWallet } = useWallet();
  const [form, setForm] = useState({ title: "", description: "", rules: "" });
  const [stage, setStage] = useState<WriteStage | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function publish(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!form.title.trim() || !form.description.trim() || !form.rules.trim()) { setError("Complete all fields before publishing your Rulebook."); return; }
    const contractAddress = getContractAddress();
    if (!contractAddress) { setError("This app is not connected to a deployed ClauseGate contract yet."); return; }
    try {
      setStage("connecting");
      const wallet = address || await connectWallet();
      const id = clientId("rb");
      const result = await new ClauseGate(contractAddress, wallet).createRulebook(id, form.title, form.description, form.rules, setStage);
      setHash(result.hash);
      router.push(`/rulebooks/${encodeURIComponent(id)}`);
    } catch (reason) {
      setStage("error");
      setError(reason instanceof Error ? reason.message : "We couldn’t publish the Rulebook. Please try again.");
    }
  }

  return <AppShell><section className="container app-main"><div className="form-layout"><div className="form-intro"><p className="eyebrow">New Rulebook</p><h1 className="page-title">Make the rules clear.</h1><p>Write one plain-language policy. It will be published as the source of truth for future reviews.</p><p className="font-mono" style={{ marginTop: 32, color: "var(--muted)", fontSize: ".68rem", lineHeight: 1.6 }}>PUBLISH / COMMIT / REVIEW</p></div><form onSubmit={publish} className="form-surface"><div className="form-section"><div className="form-field"><label className="form-label" htmlFor="title">Name</label><input id="title" className="input-field" placeholder="Hackathon Submission Rules" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} /></div><div className="form-field"><label className="form-label" htmlFor="description">Short description</label><input id="description" className="input-field" placeholder="Rules for projects submitted to the August builder round." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} /></div><div className="form-field"><label className="form-label" htmlFor="rules">Rules</label><textarea id="rules" className="textarea-field" placeholder={"1. The project must have a working public demo.\n2. Source code must be publicly accessible.\n3. The project must not include gambling functionality."} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} maxLength={12000} /><p className="form-help">Use numbered rules and explicit prohibitions where possible. Clear rules make defensible decisions easier.</p></div>{error && <div className="form-error">{error}</div>}<TransactionProgress stage={stage} hash={hash} /><div className="form-actions"><p className="muted" style={{ flex: 1, fontSize: ".72rem" }}>Publishing requires a wallet transaction.</p><button className="button-primary" type="submit" disabled={stage === "sent" || stage === "confirming"}>Publish Rulebook</button></div></div></form></div></section></AppShell>;
}
