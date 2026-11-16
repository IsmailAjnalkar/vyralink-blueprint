"use client";
// Seller earnings (blueprint C20–C22): provisional until the returns window closes, then locked, scheduled and paid.
import { Empty, Messages, PageHeader, Status, when } from "@/components/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, usd } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

type Payout = { id: string; amount_cents: number; currency: string; status: string; failure_reason: string | null; executed_at: string | null };

type Earnings = {
  provisionalCents: number; lockedCents: number; paidCents: number; onHoldCents: number; pendingApprovalCents: number;
  lines: { id: string; kind: string; basis: string; amount_cents: number; status: string; created_at: string; campaign: string | null; payout_status: string | null }[];
};

export default function EarningsPage() {
  const e = useLoad(() => api<Earnings>("seller/earnings"), "earnings");
  const payouts = useLoad(() => api<Payout[]>("seller/payouts"), "payouts");
  const d = e.data;
  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="Earnings" description="Commission stays provisional until the returns window closes; refunds can still lower it until then." />
      <Messages error={e.error} />
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[["Provisional", d.provisionalCents], ["Locked / scheduled", d.lockedCents], ["Paid", d.paidCents], ["On hold", d.onHoldCents]].map(([k, v]) => (
              <Card key={k as string}><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{k}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{usd(v as number)}</CardContent></Card>
            ))}
          </div>
          {d.lines.length === 0 ? <Empty>No earnings yet. They appear after your first completed session.</Empty> : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Campaign</TableHead><TableHead>Type</TableHead><TableHead>How it was calculated</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {d.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{when(l.created_at)}</TableCell>
                      <TableCell>{l.campaign ?? "—"}</TableCell>
                      <TableCell>{l.kind.replace(/_/g, " ")}</TableCell>
                      <TableCell className="max-w-72 text-xs text-muted-foreground">{l.basis}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{usd(l.amount_cents)}</TableCell>
                      <TableCell><Status value={l.payout_status ?? l.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
      {!!payouts.data?.length && (
        <section aria-labelledby="payouts" className="grid gap-2">
          <h2 id="payouts" className="text-lg font-semibold">Payouts</h2>
          <ul className="grid gap-1 text-sm">{payouts.data.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 rounded-md border p-2"><span>{when(p.executed_at)}</span><span className="tabular-nums">{usd(p.amount_cents)} {p.currency}</span><span><Status value={p.status} />{p.failure_reason && ` ${p.failure_reason}`}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
