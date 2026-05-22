import { MiniCalendar } from "./MiniCalendar";
import { JumpLinks } from "./JumpLinks";

export function CalendarSidebar() {
  return (
    <aside className="hidden w-[240px] flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
      <div className="sticky top-[52px] flex max-h-[calc(100dvh-52px)] flex-col gap-6 overflow-y-auto p-4">
        <section aria-labelledby="sidebar-cal-heading">
          <h2
            id="sidebar-cal-heading"
            className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-mute)]"
          >
            Navigation
          </h2>
          <MiniCalendar />
        </section>
        <section aria-labelledby="sidebar-jump-heading">
          <h2
            id="sidebar-jump-heading"
            className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-mute)]"
          >
            Jump to
          </h2>
          <JumpLinks />
        </section>
      </div>
    </aside>
  );
}
