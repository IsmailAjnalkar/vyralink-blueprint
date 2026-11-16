"use client";
// Single-series horizontal bar chart (magnitude by category). One hue (--series-1), no legend (the title names the series),
// thin bars (≤ 24px) with a rounded data end and a square baseline, value at the tip in text ink, a hover/focus tooltip,
// and a table view. Bars are sorted by the caller; color never encodes rank.
import { useState } from "react";

export type Bar = { label: string; value: number; display: string; detail?: string };

export function BarChart({ title, bars, valueLabel }: { title: string; bars: Bar[]; valueLabel: string }) {
  const [table, setTable] = useState(false);
  const [tip, setTip] = useState<number | null>(null);
  const max = Math.max(0, ...bars.map((b) => b.value));

  return (
    <figure className="grid gap-3">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <button type="button" className="text-xs underline" onClick={() => setTable((t) => !t)} aria-pressed={table}>{table ? "Show chart" : "Show as table"}</button>
      </figcaption>
      {bars.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : table ? (
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1 font-medium">Item</th><th className="py-1 text-right font-medium">{valueLabel}</th></tr></thead>
          <tbody>{bars.map((b) => <tr key={b.label} className="border-b last:border-0"><td className="py-1">{b.label}</td><td className="py-1 text-right tabular-nums">{b.display}</td></tr>)}</tbody>
        </table>
      ) : (
        <ul className="grid gap-2" aria-label={title}>
          {bars.map((b, i) => (
            <li key={b.label} className="grid grid-cols-[minmax(6rem,12rem)_1fr] items-center gap-3 text-sm">
              <span className="truncate text-muted-foreground" title={b.label}>{b.label}</span>
              <span className="relative flex items-center gap-2">
                <span
                  tabIndex={0}
                  role="img"
                  aria-label={`${b.label}: ${b.display}${b.detail ? `, ${b.detail}` : ""}`}
                  onPointerEnter={() => setTip(i)} onPointerLeave={() => setTip(null)} onFocus={() => setTip(i)} onBlur={() => setTip(null)}
                  className="block h-5 min-w-[2px] rounded-r-[4px] bg-[var(--series-1)] outline-offset-2 focus-visible:outline-2"
                  style={{ width: max ? `${Math.max(0.5, (b.value / max) * 85)}%` : "2px" }}
                />
                <span className="tabular-nums">{b.display}</span>
                {tip === i && (
                  <span role="tooltip" className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow">
                    <strong>{b.label}</strong> · {valueLabel} {b.display}{b.detail ? ` · ${b.detail}` : ""}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
