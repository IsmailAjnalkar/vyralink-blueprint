"use client";
// Brand billing (blueprint B15): invoices from Creator Hub, credit notes, disputes, CSV export.
// Card payment happens with the payment provider (Stripe), which isn't connected yet; Vyralink never stores card data.
import { Empty, Messages, PageHeader, Status, when } from "@/components/bits";
import { ExportLink } from "@/components/export-link";
import { OpenDispute } from "@/components/open-dispute";
import { useSession } from "@/components/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, usd } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

export default function Billing() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const list = useLoad(() => api<Invoice[]>("invoices", { org }), org);
  const open = list.data?.filter((i) => ["issued", "overdue"].includes(i.status) && i.kind !== "credit_note") ?? [];
  const due = open.reduce((t, i) => t + i.amount_cents, 0);

  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="Billing" description="Fees invoiced by Creator Hub. Your GMV is your sales, not a fee." actions={<ExportLink kind="invoices" org={org} />} />
      <Alert><AlertDescription>Online card payment isn’t connected yet (it will run through Stripe; Vyralink never stores card details). Pay by the method on the invoice; Creator Hub records the payment.</AlertDescription></Alert>
      <Messages error={list.error} />
      <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Open balance</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{usd(due)}</CardContent></Card>
      {list.data?.length === 0 && <Empty>No invoices yet.</Empty>}
      {!!list.data?.length && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>For</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.data.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono">{i.number}</TableCell>
                  <TableCell className="max-w-72 text-xs">{i.kind.replace("_", " ")}: {i.basis}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(i.amount_cents)} <span className="text-xs text-muted-foreground">{i.currency}</span></TableCell>
                  <TableCell><Status value={i.status} /></TableCell>
                  <TableCell>{when(i.due_at)}</TableCell>
                  <TableCell>{["issued", "overdue"].includes(i.status) && i.kind !== "credit_note" && <OpenDispute org={org} target={{ invoiceId: i.id }} types={i.kind === "cancellation" ? ["cancellation_fee"] : ["invoice"]} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
