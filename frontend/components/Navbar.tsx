"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { EXPLORER } from "@/lib/genlayer/network";
import { AccountPanel } from "./AccountPanel";
import { Logo } from "./Logo";

const CONTRACT = "0x49446d1e225Ba9821d38457DcdCAb31b2170c061";

export function Navbar() {
  const pathname = usePathname();
  const marketing = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("nav-locked", mobileOpen);
    return () => document.body.classList.remove("nav-locked");
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);
  const navClass = [
    "site-nav",
    marketing ? "site-nav-marketing" : "site-nav-app",
    marketing && scrolled ? "is-scrolled" : "",
  ].filter(Boolean).join(" ");

  return (
    <header className={navClass}>
      <div className="container nav-inner">
        <Logo />

        <nav className="desktop-nav" aria-label="Primary navigation">
          <div className="nav-menu-wrap">
            <button className="nav-menu-trigger" type="button" aria-expanded={openMenu === "product"} onClick={() => setOpenMenu(openMenu === "product" ? null : "product")}>
              Product <ChevronDown size={14} aria-hidden="true" />
            </button>
            {openMenu === "product" && (
              <div className="nav-sheet" role="menu">
                <Link href="/rulebooks" onClick={() => setOpenMenu(null)}><strong>Rulebooks</strong><span>Publish exact requirements for evaluation.</span></Link>
                <Link href="/submissions" onClick={() => setOpenMenu(null)}><strong>Submissions</strong><span>Commit proposal text for consensus review.</span></Link>
                <Link href="/submissions" onClick={() => setOpenMenu(null)}><strong>Decisions</strong><span>View finalized validator decisions.</span></Link>
                <Link href="/submissions" onClick={() => setOpenMenu(null)}><strong>Certificates</strong><span>Verify approvals issued to compliant submissions.</span></Link>
              </div>
            )}
          </div>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#security">Security</Link>
          <div className="nav-menu-wrap">
            <button className="nav-menu-trigger" type="button" aria-expanded={openMenu === "developers"} onClick={() => setOpenMenu(openMenu === "developers" ? null : "developers")}>
              Developers <ChevronDown size={14} aria-hidden="true" />
            </button>
            {openMenu === "developers" && (
              <div className="nav-sheet nav-sheet-right" role="menu">
                <a href="https://github.com/GIFTEDLOV/clausegate" target="_blank" rel="noreferrer"><strong>GitHub <ArrowUpRight size={13} /></strong><span>Inspect the source and release.</span></a>
                <a href={`${EXPLORER}/contracts/${CONTRACT}`} target="_blank" rel="noreferrer"><strong>Contract <ArrowUpRight size={13} /></strong><span>View the production Intelligent Contract.</span></a>
                <a href={`${EXPLORER}/contracts/${CONTRACT}`} target="_blank" rel="noreferrer"><strong>Bradbury deployment <ArrowUpRight size={13} /></strong><span>Open the verified production address.</span></a>
                <a href="https://www.genlayer.com" target="_blank" rel="noreferrer"><strong>GenLayer <ArrowUpRight size={13} /></strong><span>Learn about the consensus network.</span></a>
              </div>
            )}
          </div>
        </nav>

        <div className="nav-actions">
          {marketing ? <Link className="nav-cta" href="/rulebooks">Launch App <span aria-hidden="true">→</span></Link> : <AccountPanel />}
          <button className="mobile-menu-toggle" type="button" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-navigation" className="mobile-nav-panel" role="dialog" aria-label="Mobile navigation">
          <div className="mobile-nav-links">
            <span className="eyebrow">Explore</span>
            <Link href="/rulebooks" onClick={closeMobile}>Rulebooks <span>↗</span></Link>
            <Link href="/submissions" onClick={closeMobile}>Submissions <span>↗</span></Link>
            <Link href="/#how-it-works" onClick={closeMobile}>How it works <span>↓</span></Link>
            <Link href="/#security" onClick={closeMobile}>Security <span>↓</span></Link>
            <span className="eyebrow mobile-nav-developers">Developers</span>
            <a href="https://github.com/GIFTEDLOV/clausegate" target="_blank" rel="noreferrer">GitHub <span>↗</span></a>
            <a href={`${EXPLORER}/contracts/${CONTRACT}`} target="_blank" rel="noreferrer">Contract <span>↗</span></a>
          </div>
          <Link className="button-primary mobile-launch" href="/rulebooks" onClick={closeMobile}>Launch App <span>→</span></Link>
        </div>
      )}
    </header>
  );
}
