import { TableSkeleton } from "./_components/TableSkeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="h-[40px] border-b border-[var(--color-border)] bg-[var(--color-surface)]" />
      <TableSkeleton />
    </div>
  );
}
