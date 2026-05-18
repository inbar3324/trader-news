export const metadata = { title: "Breaking news — TraderNews" };

export default function BreakingPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Breaking news</h1>
      <p className="mt-2 text-[var(--color-text-dim)]">
        Real-time stream of market-moving headlines from Yahoo Finance + Gemini-verified
        summaries.
      </p>
      <div className="mt-6 rounded border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-[var(--color-text-mute)]">
        Coming in v1.
      </div>
    </div>
  );
}
