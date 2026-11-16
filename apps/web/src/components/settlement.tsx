"use client";
// Session results after closeout: what was sold, what counts, and what everyone is owed. Each figure names its source.
// Studio staff (producer, location manager, finance) import the TikTok Shop order and refund reports here.
import { Messages, Status, textareaClass, when } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, usd } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Settlement = {
  resultsStatus: string; returnsWindowEndsAt: string | null; liveMinutes: number; gmvCents: number; refundsCents: number; eligibleCents: number;
  basePayCents: number; commissionCents: number; bonusCents: number; performanceFeeCents?: number; productionFeeCents?: number; gmvPerHourCents: number | null;
  sources: Record<string, string>;
};

export function SessionResults({ bookingId, org, canImport }: { bookingId: string; org?: string; canImport: boolean }) {
  const s = useLoad(() => api<Settlement>(`bookings/${bookingId}/settlement`, { org }), `${org}:${bookingId}`);
  const act = useAction(s.reload);
  const d = s.data;

  function upload(kind: "results" | "refunds") {
    return async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const file = f.get("file");
      const csv = file instanceof File && file.size ? await file.text() : String(f.get("csv") ?? "");
      await act.run(() => api<{ imported: number }>(`bookings/${bookingId}/${kind}`, { org, body: { csv } }), (r) => `${r.imported} ${kind === "results" ? "orders" : "refund rows"} imported.`);
    };
  }

  const rows: [string, number | null | undefined, string?][] = d ? [
    ["Attributed GMV", d.gmvCents, d.sources.orders], ["Refunds and cancellations", -d.refundsCents], ["Eligible sales", d.eligibleCents],
    ["Seller base pay", d.basePayCents, d.sources.liveHours], ["Seller commission", d.commissionCents], ["Seller bonus", d.bonusCents],
    ...(d.performanceFeeCents != null ? [["Performance fee (brand)", d.performanceFeeCents] as [string, number]] : []),
    ...(d.productionFeeCents != null ? [["Production fee (brand)", d.productionFeeCents] as [string, number]] : []),
  ] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Results {d && <Status value={d.resultsStatus} />}</CardTitle>
        <CardDescription>{d ? <>LIVE time {Math.floor(d.liveMinutes / 60)} h {d.liveMinutes % 60} min (studio log){d.returnsWindowEndsAt && ` · returns window ends ${when(d.returnsWindowEndsAt)}`}. Figures stay provisional until finance locks them.</> : "Loading…"}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Messages error={act.error ?? s.error} notice={act.notice} />
        {d && (
          <table className="w-full max-w-lg text-sm">
            <tbody>
              {rows.map(([k, v, src]) => (
                <tr key={k} className="border-b last:border-0">
                  <th scope="row" className="py-1 text-left font-normal text-muted-foreground">{k}{src && <span className="ml-1 text-[11px]">({src})</span>}</th>
                  <td className="py-1 text-right font-medium tabular-nums">{usd(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canImport && d && d.resultsStatus !== "locked" && (
          <form onSubmit={upload("results")} className="grid gap-2">
            <h3 className="text-sm font-semibold">Import the TikTok Shop order report</h3>
            <p className="text-xs text-muted-foreground">CSV columns: order_id, placed_at, amount_cents, status (completed / cancelled / refunded), optional attributed. Re-importing replaces rows with the same order_id.</p>
            <input type="file" name="file" accept=".csv,text/csv" aria-label="Order report file" className="text-sm" />
            <label htmlFor={`csv-${bookingId}`} className="text-xs">…or paste the CSV</label>
            <textarea id={`csv-${bookingId}`} name="csv" className={`${textareaClass} font-mono text-xs`} placeholder={"order_id,placed_at,amount_cents,status\nO1,2026-11-16T19:05:00Z,4000,completed"} />
            <Button type="submit" size="sm" className="w-fit" disabled={act.busy}>Import orders</Button>
          </form>
        )}
        {canImport && d && d.resultsStatus !== "pending" && (
          <form onSubmit={upload("refunds")} className="grid gap-2">
            <h3 className="text-sm font-semibold">Import refunds</h3>
            <p className="text-xs text-muted-foreground">CSV columns: order_id, refund_cents. After results are locked, refunds become adjustments and credit notes.</p>
            <input type="file" name="file" accept=".csv,text/csv" aria-label="Refunds file" className="text-sm" />
            <label htmlFor={`ref-${bookingId}`} className="text-xs">…or paste the CSV</label>
            <textarea id={`ref-${bookingId}`} name="csv" className={`${textareaClass} font-mono text-xs`} placeholder={"order_id,refund_cents\nO1,4000"} />
            <Button type="submit" size="sm" variant="outline" className="w-fit" disabled={act.busy}>Import refunds</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
