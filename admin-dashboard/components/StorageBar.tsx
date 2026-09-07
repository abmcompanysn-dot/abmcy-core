import { formatBytes, usagePercent } from "@/lib/format";

export function StorageBar({
  used,
  limit,
}: {
  used: number;
  limit: number;
}) {
  const pct = usagePercent(used, limit);
  const barColor =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-500";

  return (
    <div className="min-w-[160px]">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {formatBytes(used)} / {formatBytes(limit)}{" "}
        <span className="text-slate-400">({pct.toFixed(0)}%)</span>
      </p>
    </div>
  );
}
