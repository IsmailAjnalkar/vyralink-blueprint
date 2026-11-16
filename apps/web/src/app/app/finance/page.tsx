"use client";
// Creator Hub finance overview (blueprint F01): revenue is Creator Hub fees only; GMV is brand sales, shown for context.
// Work queue: completed sessions whose returns window has closed, ready to lock.
import Link from "next/link";
import { Empty, Messages, PageHeader, Status, when } from "@/components/bits";
import { ExportLink } from "@/components/export-link";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, usd } from "@/lib/api";
import type { Booking } from "@/lib/types";
import { useAction, useLoad } from "@/lib/use-load";

type Overview = {
  recognized_revenue_cents: number; pending_invoices_cents: number; receivable_cents: number; overdue_cents: number;
  sellerCompensation: { paid_cents: number; accrued_cents: number }; brandGmvContextCents: number; workQueue: { ready_to_lock: number }; note: string;
};
type Done = Booking & { results_status: string; returns_window_ends_at: string | null };

export default function FinanceOverview() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const o = useLoad(() => api<Overview>("finance/overview", { org }), org);
  const done = useLoad(() => api<Done[]>("bookings?status=completed", { org }), `${org}:done`);
  const act = useAction(() => Promise.all([o.reload(), done.reload()]));
  const d = o.data;

  if (current?.role !== "finance_admin") return <PageHeader title="Finance" description="Finance administrators only." />;
  return (
    <div className="grid max-w-6xl gap-6">
      <PageHeader title="Finance" description={d?.note} actions={<><ExportLink kind="invoices" org={org} /><ExportLink kind="ledger" org={org} /><ExportLink kind="payouts" org={org} /></>} />
      <Messages error={act.error ?? o.error ?? done.error} notice={act.notice} />
      {d && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[["Recognized revenue", d.recognized_revenue_cents], ["Receivable", d.receivable_cents], ["Overdue", d.overdue_cents], ["Seller pay accrued", d.sellerCompensation.accrued_cents], ["Seller pay paid", d.sellerCompensation.paid_cents], ["Brand GMV (context, not revenue)", d.brandGmvContextCents]].map(([k, v]) => (
            <Card key={k as string}><CardHeader><CardTitle className="text-xs font-medium text-muted-foreground">{k}</CardTitle></CardHeader><CardContent className="text-xl font-bold tabular-nums">{usd(v as number)}</CardContent></Card>
          ))}
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>Results to lock</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Locking makes results final: it locks seller commission and bonus and issues the performance-fee invoice. Later refunds become adjustments and credit notes.</p>
          {done.data?.length === 0 && <Empty>No completed sessions.</Empty>}
          {!!done.data?.length && (
            <Table>
              <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Results</TableHead><TableHead>Returns window ends</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {done.data.map((b) => {
                  const ready = b.results_status === "imported" && (!b.returns_window_ends_at || new Date(b.returns_window_ends_at) <= new Date());
                  return (
                    <TableRow key={b.id}>
                      <TableCell><Link className="font-medium hover:underline" href={`/app/studio/bookings/${b.id}`}>{b.campaign}</Link></TableCell>
                      <TableCell><Status value={b.results_status} /></TableCell>
                      <TableCell>{when(b.returns_window_ends_at)}</TableCell>
                      <TableCell>{b.results_status !== "locked" && <Button size="sm" disabled={!ready || act.busy} title={ready ? undefined : "Import results and wait for the returns window to close"} onClick={() => act.run(() => api(`bookings/${b.id}/lock`, { org, body: {} }), `${b.campaign}: results locked, performance fee invoiced.`)}>Lock results</Button>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <nav aria-label="Finance sections" className="flex flex-wrap gap-2 text-sm">
        {[["Invoices", "invoices"], ["Seller ledger", "ledger"], ["Payout runs", "payouts"], ["Disputes", "disputes"]].map(([k, h]) => <Button key={h} asChild variant="outline"><Link href={`/app/finance/${h}`}>{k}</Link></Button>)}
      </nav>
    </div>
  );
}
