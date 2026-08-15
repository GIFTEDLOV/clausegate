"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountPanel } from "./AccountPanel";
import { Logo } from "./Logo";

const links = [
  { href: "/rulebooks", label: "Rulebooks" },
  { href: "/submissions", label: "Submissions" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="container flex h-[68px] items-center justify-between gap-5">
        <Logo />
        <nav className="hidden items-center gap-6 sm:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname.startsWith(link.href) ? "nav-link-active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/rulebooks/new" className="nav-link nav-link-accent">New Rulebook</Link>
        </nav>
        <AccountPanel />
      </div>
    </header>
  );
}
