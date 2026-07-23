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
    <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">

      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 shadow-xs border-l-4 border-l-blue-500 flex flex-col justify-center">
        <span className="text-xs font-bold text-blue-700 block uppercase tracking-wider">First ID</span>
        <div className="mt-1">
          <span className="text-2xl font-black text-blue-700 font-mono">{stats.firstBoxId}</span>
        </div>
      </div>

      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 shadow-xs border-l-4 border-l-amber-500 flex flex-col justify-center">
        <span className="text-xs font-bold text-amber-700 block uppercase tracking-wider">Last ID</span>
        <div className="mt-1">
          <span className="text-2xl font-black text-amber-700 font-mono">{stats.lastBoxId}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs border-l-4 border-l-red-500 flex flex-col justify-center">
        <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Box Bị Loại Trừ</span>
        <div className="flex items-baseline space-x-1.5 mt-1">
          <span className="text-2xl font-black text-red-600">{stats.excludeCount}</span>
          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap leading-none">(Exclude)</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-center">
        <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Box Trùng Lặp</span>
        <div className="flex items-baseline space-x-1.5 mt-1">
          <span className="text-2xl font-black text-rose-500">{stats.totalDuplicates}</span>
          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap leading-none">(Duplicate)</span>
        </div>
      </div>

      <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-xs border-l-4 border-l-emerald-500 flex flex-col justify-center">
        <span className="text-xs font-bold text-emerald-700 block uppercase tracking-wider">Tổng Số Box</span>
        <div className="flex items-baseline space-x-1.5 mt-1">
          <span className="text-2xl font-black text-emerald-600">{stats.finalCount}</span>
          <span className="text-[9px] text-emerald-600 font-bold whitespace-nowrap leading-none">(Total Box)</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-center">
        <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Tổng số Frame</span>
        <div className="flex items-baseline space-x-1.5 mt-1">
          <span className="text-2xl font-black text-slate-900">{stats.totalFrames}</span>
          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap leading-none">frames</span>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 shadow-xs text-white flex flex-col justify-center">
        <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Frame Skip</span>
        <div className="flex items-baseline space-x-1.5 mt-1">
          <span className="text-2xl font-black text-red-400">{stats.framesWithSkipCount}</span>
          <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap leading-none">(Passed Frame)</span>
        </div>
      </div>
    </div>
  );
}
