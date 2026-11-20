interface StatsGridProps {
  stats: {
    firstBoxId: string;
    lastBoxId: string;
    excludeCount: number;
    totalDuplicates: number;
    finalCount: number;
    totalFrames: number;
    framesWithSkipCount: number;
  };
}

export default function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="app-stats-grid grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
      <div className="dt-panel border-l-[3px] border-l-[var(--accent-primary)] px-3 py-2.5">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          First ID
        </span>
        <div className="mt-1">
          <span className="dt-mono text-xl font-bold text-[var(--accent-text)]">{stats.firstBoxId}</span>
        </div>
      </div>

      <div className="dt-panel border-l-[3px] border-l-[var(--status-warning)] px-3 py-2.5">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Last ID
        </span>
        <div className="mt-1">
          <span className="dt-mono text-xl font-bold text-[var(--status-warning-text)]">{stats.lastBoxId}</span>
        </div>
      </div>

      <div className="dt-panel border-l-[3px] border-l-[var(--status-danger)] px-3 py-2.5">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Box Bị Loại Trừ
        </span>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="dt-mono text-xl font-bold text-[var(--status-danger-text)]">{stats.excludeCount.toLocaleString()}</span>
          <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">(Exclude)</span>
        </div>
      </div>

      <div className="dt-panel border-l-[3px] border-l-[var(--status-danger)] px-3 py-2.5">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Box Trùng Lặp
        </span>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="dt-mono text-xl font-bold text-[var(--status-danger)]">{stats.totalDuplicates.toLocaleString()}</span>
          <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">(Duplicate)</span>
        </div>
      </div>

      <div className="dt-panel border-l-[3px] border-l-[var(--status-success)] px-3 py-2.5">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Tổng Số Box
        </span>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="dt-mono text-xl font-bold text-[var(--status-success-text)]">{stats.finalCount.toLocaleString()}</span>
          <span className="text-[10px] text-[var(--status-success)] font-medium whitespace-nowrap">(Total Box)</span>
        </div>
      </div>

      <div className="dt-panel px-3 py-2.5">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Tổng số Frame
        </span>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="dt-mono text-xl font-bold text-[var(--text-primary)]">{stats.totalFrames.toLocaleString()}</span>
          <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">frames</span>
        </div>
      </div>

      <div className="dt-panel px-3 py-2.5">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Frame Skip
        </span>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="dt-mono text-xl font-bold text-[var(--status-danger-text)]">{stats.framesWithSkipCount.toLocaleString()}</span>
          <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">(Passed Frame)</span>
        </div>
      </div>
    </div>
  );
}
