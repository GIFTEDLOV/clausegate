"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Copy } from "lucide-react";
import { useState } from "react";

import { EXPLORER } from "@/lib/genlayer/network";

const CONTRACT = "0x49446d1e225Ba9821d38457DcdCAb31b2170c061";
const COMPLIANT_ID = "clausegate-compliant-20260816";
const NONCOMPLIANT_ID = "clausegate-noncompliant-20260816";
const COMPLIANT_REVIEW = "0xac0d127d3cfb29fe202d91851129bb77814ef21ba4f17c1d61aee0e07bd675bb";
const NONCOMPLIANT_REVIEW = "0x8a0119082d0b69e1f5833b212d08cb84acf5fe5a09e088f31e560af1e41c30d7";

const txHref = (hash: string) => `${EXPLORER}/transactions/${hash}`;

export function HeroConsensusField() {
  return (
    <div className="consensus-field" aria-hidden="true">
      <svg className="consensus-svg" viewBox="0 0 1440 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="signal-line" x1="0" x2="1">
            <stop offset="0" stopColor="#c9f36a" stopOpacity="0" />
            <stop offset=".42" stopColor="#c9f36a" stopOpacity=".55" />
            <stop offset="1" stopColor="#fff" stopOpacity=".8" />
          </linearGradient>
        </defs>
        <path className="consensus-path" d="M-80 190 C260 80 520 610 850 380 C1020 265 1130 344 1510 270" />
        <path className="consensus-path" d="M-80 430 C260 520 490 110 820 390 C1050 585 1125 354 1510 470" />
        <path className="consensus-path" d="M-80 650 C240 520 520 260 810 420 C1050 550 1210 430 1510 610" />
        <path className="consensus-path" stroke="url(#signal-line)" d="M-80 320 C250 250 490 390 760 420 C960 442 1040 423 1510 423" />
        <circle cx="824" cy="420" r="4" fill="#c9f36a" />
        <text className="consensus-label" x="720" y="350">RULEBOOK</text>
        <text className="consensus-label" x="940" y="505">CONSENSUS</text>
      </svg>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <HeroConsensusField />
      <div className="container hero-grid">
        <div className="hero-content">
          <p className="eyebrow hero-kicker">Institutional decision infrastructure</p>
          <h1 className="hero-headline">Rules in.<span className="hero-serif">Decisions out.</span></h1>
          <p className="hero-copy">Publish the rules. Submit a proposal. Let independent GenLayer validators reach a verifiable compliance decision.</p>
          <div className="hero-actions">
            <Link href="/rulebooks" className="button-primary">Launch ClauseGate <ArrowRight size={16} /></Link>
            <Link href={`/submissions/${COMPLIANT_ID}`} className="button-secondary">See a live decision</Link>
          </div>
        </div>
        <div className="hero-proof-strip"><strong>LIVE ON GENLAYER BRADBURY</strong><span>·</span><span>CONSENSUS VERIFIED</span><span>·</span><span>ONCHAIN CERTIFICATES</span></div>
      </div>
      <div className="scroll-marker">Scroll to explore</div>
    </section>
  );
}

function ProtocolDiagram() {
  return (
    <div className="protocol-diagram" aria-label="Rulebook to decision consensus flow">
      <div className="diagram-stage"><span className="diagram-label">01 / INPUT</span><span className="diagram-node">RULEBOOK</span></div>
      <div className="diagram-stage"><span className="diagram-label">02 / COMMIT</span><span className="diagram-node">PROPOSAL</span></div>
      <div className="diagram-stage"><span className="diagram-label">03 / EVALUATE</span><div className="diagram-branches"><span className="diagram-branch" /><span className="diagram-branch" /><span className="diagram-branch" /></div></div>
      <div className="diagram-stage"><span className="diagram-label">04 / AGREE</span><span className="diagram-node">CONSENSUS</span></div>
      <div className="diagram-stage"><span className="diagram-label">05 / OUTPUT</span><span className="diagram-node">DECISION</span></div>
      <p className="muted" style={{ margin: "22px 0 0", color: "rgba(255,255,255,.5)", fontSize: ".72rem" }}>Independent validators</p>
    </div>
  );
}

function LiveProofPanel({ compliant }: { compliant: boolean }) {
  const id = compliant ? COMPLIANT_ID : NONCOMPLIANT_ID;
  const review = compliant ? COMPLIANT_REVIEW : NONCOMPLIANT_REVIEW;
  return (
    <article className={`proof-panel ${compliant ? "proof-compliant" : "proof-non"}`}>
      <div className="proof-meta"><span className="eyebrow">{compliant ? "COMPLIANT" : "NON_COMPLIANT"}</span><span className="font-mono" style={{ color: "var(--muted)", fontSize: ".62rem" }}>FINALIZED · AGREE · FINISHED_WITH_RETURN</span></div>
      <h3 className="proof-title">{compliant ? "ClauseGate public demo" : "Private football wagering app"}</h3>
      <div className="proof-verdict">{compliant ? "COMPLIANT" : "NON_COMPLIANT"}</div>
      <p className="proof-copy">{compliant ? "Certificate issued and result digest independently verified." : "No approval certificate was issued."}</p>
      <div className="proof-actions"><Link href={`/submissions/${id}`}>View decision <ArrowRight size={14} /></Link><a href={txHref(review)} target="_blank" rel="noreferrer">View transaction <ArrowUpRight size={14} /></a></div>
    </article>
  );
}

function Transparency() {
  const [copied, setCopied] = useState(false);
  const copyAddress = async () => {
    await navigator.clipboard.writeText(CONTRACT);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <section id="developers" className="editorial-section section-paper">
      <div className="container transparency-grid">
        <div><p className="eyebrow">Transparency</p><h2 className="editorial-lead" style={{ marginTop: 20 }}>Built to be <em>inspected.</em></h2><div className="metrics"><div className="metric"><strong>GENLAYER</strong><span>Network</span></div><div className="metric"><strong>BRADBURY</strong><span>Production deployment</span></div><div className="metric"><strong>3</strong><span>Verdict states</span></div></div></div>
        <div>
          <div className="technical-panel">
            <div className="technical-row"><span className="technical-label">Production contract</span><span className="technical-value">{CONTRACT}<button className="copy-button" type="button" onClick={copyAddress} aria-label="Copy production contract address"><Copy size={13} /> {copied ? "Copied" : "Copy"}</button></span></div>
            <div className="technical-row"><span className="technical-label">Network</span><span className="technical-value">GenLayer Bradbury</span></div>
            <div className="technical-row"><span className="technical-label">Production frontend release</span><span className="technical-value">ClauseGate institutional frontend</span></div>
          </div>
          <div className="technical-actions"><a href="https://github.com/GIFTEDLOV/clausegate" target="_blank" rel="noreferrer">View source <ArrowUpRight size={14} /></a><a href={`${EXPLORER}/contracts/${CONTRACT}`} target="_blank" rel="noreferrer">View contract <ArrowUpRight size={14} /></a></div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <>
      <Hero />
      <section className="editorial-section section-paper"><div className="container"><p className="eyebrow">The premise</p><h2 className="editorial-lead" style={{ marginTop: 20 }}>Rules shouldn&apos;t depend on who happens to review them.</h2><p className="section-copy">ClauseGate turns published requirements into a verifiable review workflow backed by independent GenLayer validators.</p><div className="editorial-columns"><div className="editorial-step"><span className="step-number">01</span><h3>Publish</h3><p>Create a Rulebook containing the exact requirements.</p></div><div className="editorial-step"><span className="step-number">02</span><h3>Submit</h3><p>Commit the proposal exactly as it should be reviewed.</p></div><div className="editorial-step"><span className="step-number">03</span><h3>Decide</h3><p>Independent validators evaluate the same inputs and reach consensus.</p></div></div></div></section>
      <section id="how-it-works" className="editorial-section section-dark"><div className="container protocol-grid"><div><p className="eyebrow" style={{ color: "var(--signal)" }}>Protocol</p><h2 className="protocol-title">One Rulebook. One proposal. Independent review. One verifiable result.</h2><p className="section-copy">The Rulebook and proposal become committed inputs to the Intelligent Contract. Validators evaluate the same stored information, and only a finalized consensus result becomes the decision.</p></div><ProtocolDiagram /></div></section>
      <section className="editorial-section section-paper"><div className="container"><div className="live-proof-head"><div><p className="eyebrow">Live proof</p><h2 className="editorial-lead" style={{ marginTop: 20 }}>Don&apos;t take our word for it.</h2><p className="section-copy">ClauseGate is deployed on Bradbury and has finalized decisions on both sides of the compliance boundary.</p></div></div><div className="proof-grid"><LiveProofPanel compliant /><LiveProofPanel compliant={false} /></div></div></section>
      <section id="security" className="editorial-section section-dark"><div className="container"><p className="eyebrow" style={{ color: "var(--signal)" }}>Why GenLayer</p><h2 className="editorial-lead" style={{ marginTop: 20 }}>Not another <em>AI wrapper.</em></h2><p className="section-copy">ClauseGate does not ask a backend model for an answer and display it as truth. The Rulebook and proposal are committed to the Intelligent Contract. Independent GenLayer validators evaluate the same stored inputs and consensus determines the finalized result.</p><div className="principles-grid"><div className="principle"><span className="step-number">01</span><h3>Exact inputs</h3><p>Published Rulebook and proposal text become the review inputs.</p></div><div className="principle"><span className="step-number">02</span><h3>Independent evaluation</h3><p>Validators independently evaluate the same committed information.</p></div><div className="principle"><span className="step-number">03</span><h3>Strict output</h3><p>Only COMPLIANT, NON_COMPLIANT or UNCLEAR are valid decisions.</p></div><div className="principle"><span className="step-number">04</span><h3>Verifiable approval</h3><p>Certificates exist only for finalized compliant decisions.</p></div></div></div></section>
      <section className="editorial-section section-paper"><div className="container"><p className="eyebrow">Verdict states</p><h2 className="editorial-lead" style={{ marginTop: 20 }}>Three outcomes. No hidden fourth state.</h2><div className="verdict-list"><div className="verdict-row"><div className="verdict-name" style={{ color: "var(--compliant)" }}>COMPLIANT</div><p className="verdict-definition">The proposal satisfies the published Rulebook and receives an approval certificate after finalized consensus.</p><span className="verdict-dot compliant" /></div><div className="verdict-row"><div className="verdict-name" style={{ color: "var(--noncompliant)" }}>NON_COMPLIANT</div><p className="verdict-definition">The proposal does not satisfy the published requirements. No approval certificate is issued.</p><span className="verdict-dot noncompliant" /></div><div className="verdict-row"><div className="verdict-name" style={{ color: "var(--unclear)" }}>UNCLEAR</div><p className="verdict-definition">The result cannot be resolved to a compliant or non-compliant decision under the protocol.</p><span className="verdict-dot unclear" /></div></div></div></section>
      <section className="editorial-section section-paper" style={{ paddingTop: 0 }}><div className="container"><p className="eyebrow">Possible applications</p><h2 className="editorial-lead" style={{ marginTop: 20 }}>One decision primitive. Many rule systems.</h2><div className="application-list">{["Hackathon eligibility", "Grant requirements", "Marketplace policies", "Procurement rules", "Content standards", "Program applications", "DAO policies", "Listing requirements"].map((item, index) => <div className="application-row" key={item}><span>{item}</span><span>{String(index + 1).padStart(2, "0")} / EXAMPLE</span></div>)}</div></div></section>
      <Transparency />
      <section className="final-cta"><div className="container"><h2>Make the rules clear.<span>Let consensus enforce them.</span></h2><div className="final-cta-actions"><Link className="button-primary" href="/rulebooks/new">Create a Rulebook <ArrowRight size={16} /></Link><Link href="/rulebooks">Browse existing Rulebooks</Link></div></div></section>
    </>
  );
}
