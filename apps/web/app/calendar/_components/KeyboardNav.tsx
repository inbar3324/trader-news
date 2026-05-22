"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getStoredDensity,
  getStoredTheme,
  setStoredDensity,
  setStoredTheme,
  type Density,
} from "@/lib/theme";
import { KeyboardCheatsheet } from "./KeyboardCheatsheet";

const DENSITY_CYCLE: ReadonlyArray<Density> = ["compact", "cozy", "relaxed"];
const PREFIX_TIMEOUT_MS = 1000;

export function KeyboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const indexRef = useRef<number>(-1);
  const prefixRef = useRef<{ key: string; t: number } | null>(null);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  // Keep these in refs so the effect doesn't re-bind on URL change
  const pathnameRef = useRef(pathname);
  const paramsRef = useRef(params);
  useEffect(() => {
    pathnameRef.current = pathname;
    paramsRef.current = params;
  }, [pathname, params]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scrollBehavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

    function rows(): HTMLTableRowElement[] {
      return Array.from(document.querySelectorAll("tr.event-row"));
    }

    function dayHeaderForRow(row: HTMLTableRowElement): HTMLTableRowElement | null {
      let prev = row.previousElementSibling as HTMLElement | null;
      while (prev) {
        if (prev.classList.contains("day-divider")) return prev as HTMLTableRowElement;
        prev = prev.previousElementSibling as HTMLElement | null;
      }
      return null;
    }

    function setActive(i: number) {
      const all = rows();
      if (all.length === 0) return;
      const clamped = Math.max(0, Math.min(i, all.length - 1));
      all.forEach((r, idx) => r.classList.toggle("kbd-active", idx === clamped));
      indexRef.current = clamped;
      all[clamped]?.scrollIntoView({ block: "nearest", behavior: scrollBehavior });
    }

    function jumpDay(direction: 1 | -1) {
      const all = rows();
      if (all.length === 0) return;
      const current = indexRef.current < 0 ? 0 : indexRef.current;
      const currentDay = dayHeaderForRow(all[current]);
      if (direction === 1) {
        for (let i = current + 1; i < all.length; i++) {
          if (dayHeaderForRow(all[i]) !== currentDay) {
            setActive(i);
            return;
          }
        }
      } else {
        const prevDay = currentDay
          ? (currentDay.previousElementSibling as HTMLElement | null)
          : null;
        let prevDayHeader: HTMLTableRowElement | null = null;
        let scan = prevDay;
        while (scan) {
          if (scan.classList.contains("day-divider")) {
            prevDayHeader = scan as HTMLTableRowElement;
            break;
          }
          scan = scan.previousElementSibling as HTMLElement | null;
        }
        if (!prevDayHeader) {
          setActive(0);
          return;
        }
        for (let i = 0; i < all.length; i++) {
          if (dayHeaderForRow(all[i]) === prevDayHeader) {
            setActive(i);
            return;
          }
        }
      }
    }

    function setRange(range: string) {
      const next = new URLSearchParams(paramsRef.current.toString());
      next.set("range", range);
      next.delete("d");
      router.replace(`${pathnameRef.current}?${next.toString()}`);
    }

    function cycleDensity() {
      const cur = getStoredDensity();
      const idx = DENSITY_CYCLE.indexOf(cur);
      const next = DENSITY_CYCLE[(idx + 1) % DENSITY_CYCLE.length];
      setStoredDensity(next);
    }

    function toggleTheme() {
      const cur = getStoredTheme();
      setStoredTheme(cur === "dark" ? "light" : "dark");
    }

    function consumePrefix(key: string): boolean {
      const p = prefixRef.current;
      if (!p) return false;
      if (Date.now() - p.t > PREFIX_TIMEOUT_MS) {
        prefixRef.current = null;
        return false;
      }
      if (p.key === "g") {
        prefixRef.current = null;
        if (key === "t") {
          setRange("today");
          return true;
        }
        if (key === "w") {
          setRange("week");
          return true;
        }
        if (key === "n") {
          setRange("next");
          return true;
        }
        if (key === "m") {
          setRange("month");
          return true;
        }
      }
      return false;
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
      const hasMod = e.metaKey || e.ctrlKey || e.altKey;

      if (hasMod) return;

      // Focus search input from anywhere except inside another input
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        document.getElementById("calendar-search")?.focus();
        return;
      }

      // Show keyboard cheatsheet
      if ((e.key === "?" || (e.shiftKey && e.key === "/")) && !isTyping) {
        e.preventDefault();
        setCheatsheetOpen(true);
        return;
      }

      // Escape always clears row selection / closes cheatsheet
      if (e.key === "Escape") {
        if (cheatsheetOpen) {
          setCheatsheetOpen(false);
          return;
        }
        if (!isTyping) {
          rows().forEach((r) => r.classList.remove("kbd-active"));
          indexRef.current = -1;
        }
        return;
      }

      if (isTyping) return;

      // Multi-stroke prefix consumption (g+x)
      if (consumePrefix(e.key)) {
        e.preventDefault();
        return;
      }

      // Start a 'g' prefix
      if (e.key === "g") {
        e.preventDefault();
        prefixRef.current = { key: "g", t: Date.now() };
        return;
      }

      const all = rows();

      // Day-jump (shift)
      if (e.shiftKey && (e.key === "J" || e.key === "j")) {
        e.preventDefault();
        jumpDay(1);
        return;
      }
      if (e.shiftKey && (e.key === "K" || e.key === "k")) {
        e.preventDefault();
        jumpDay(-1);
        return;
      }

      if (e.shiftKey) return;

      // Row navigation
      if (e.key === "j" || e.key === "ArrowDown") {
        if (all.length === 0) return;
        e.preventDefault();
        setActive(indexRef.current < 0 ? 0 : indexRef.current + 1);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        if (all.length === 0) return;
        e.preventDefault();
        setActive(indexRef.current < 0 ? 0 : indexRef.current - 1);
        return;
      }
      if (e.key === "Enter" && indexRef.current >= 0) {
        const link = all[indexRef.current]?.querySelector("a");
        const href = link?.getAttribute("href");
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }

      // Single-stroke utilities
      if (e.key === "d") {
        e.preventDefault();
        cycleDensity();
        return;
      }
      if (e.key === "t") {
        e.preventDefault();
        toggleTheme();
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, cheatsheetOpen]);

  return (
    <KeyboardCheatsheet open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
  );
}
