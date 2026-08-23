import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrustLayer AI",
  description: "Open-source AI security assessment running on your device.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link className="brand" href="/">
              <span className="brand-mark">T</span>
              TrustLayer AI
            </Link>
            <nav className="nav" aria-label="Primary navigation">
              <Link href="/">Overview</Link>
              <Link href="/assets/new">Add AI system</Link>
            </nav>
            <div className="local-device-badge">Local · your data stays here</div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
