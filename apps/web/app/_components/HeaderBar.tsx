"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HeaderAuth } from "./HeaderAuth";
import { DensityToggle } from "./DensityToggle";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPaletteTrigger } from "./CommandPaletteTrigger";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";

const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/calendar", label: "Calendar" },
  { href: "/breaking", label: "Breaking" },
];

export function HeaderBar() {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border-strong)] bg-[var(--color-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface)]/80">
      <div className="mx-auto flex h-[52px] max-w-[1600px] items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/calendar"
            aria-label="TraderNews home"
            className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-md"
          >
            <Logo size={20} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
              TraderNews
            </span>
            <span className="ml-1 rounded bg-[var(--color-surface-hi)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
              v0.2
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative px-2 py-1 text-[13px] transition-colors ${
                    active
                      ? "text-[var(--color-text)]"
                      : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-[15px] left-0 right-0 h-[2px] bg-[var(--color-accent)]"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
          <span className="mx-1 hidden h-5 w-px bg-[var(--color-border)] md:inline-block" />
          <div className="hidden md:block">
            <DensityToggle />
          </div>
          <ThemeToggle />
          <HeaderAuth />
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
