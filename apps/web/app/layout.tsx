import type { Metadata } from "next";
import "./globals.css";
import { HeaderAuth } from "./_components/HeaderAuth";

export const metadata: Metadata = {
  title: "TraderNews — AI economic calendar for day traders",
  description:
    "Forex Factory–style calendar with AI explainers, historical reaction stats, and intraday volatility scores.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                <span className="font-semibold tracking-tight">TraderNews</span>
                <span className="ml-2 rounded bg-[var(--color-surface-hi)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
                  v0.2
                </span>
              </div>
              <nav className="flex items-center gap-4 text-[12px] text-[var(--color-text-dim)]">
                <a href="/calendar" className="hover:text-[var(--color-text)]">Calendar</a>
                <a href="/breaking" className="hover:text-[var(--color-text)]">Breaking</a>
                <HeaderAuth />
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
