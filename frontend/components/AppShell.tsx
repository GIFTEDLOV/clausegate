"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnnouncementBar } from "./AnnouncementBar";
import { Navbar } from "./Navbar";
import { SiteFooter } from "./SiteFooter";

export function AppShell({ children }: { children: ReactNode }) {
  const marketing = usePathname() === "/";
  return (
    <div className={marketing ? "site-frame site-frame-marketing" : "site-frame site-frame-app"}>
      {marketing && <AnnouncementBar />}
      <Navbar />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
