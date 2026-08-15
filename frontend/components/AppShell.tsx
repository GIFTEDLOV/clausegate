import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>{children}</main>
      <footer className="container flex flex-col gap-2 border-t border-line py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>ClauseGate · Rules in. Decisions out.</span>
        <span>Consensus-powered compliance reviews on GenLayer.</span>
      </footer>
    </div>
  );
}
