"use client";
import { useAsk } from "@/components/ask";
// Creator Hub invoices (blueprint F02): production, performance and cancellation fees, credit notes.
// "Mark paid" stands in for the payment provider's webhook until Stripe is connected (sandbox, audited).
import { useState } from "react";
import { Empty, Messages, PageHeader, Status, selectClass, when } from "@/components/bits";
import { ExportLink } from "@/components/export-link";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, toUnits, usd } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { useAction, useLoad } from "@/lib/use-load";

export default function FinanceInvoices() {
  const { current } = useSession();
  const { ask, one } = useAsk();
  const org = current?.org_id ?? "";
  const [status, setStatus] = useState("");
  const list = useLoad(() => api<Invoice[]>(`invoices${status ? `?status=${status}` : ""}`, { org }), `${org}:${status}`);
  const act = useAction(list.reload);
  const post = (path: string, body: unknown = {}) => () => api(path, { org, body });

  async function credit(i: Invoice) {
    const v = await ask({ title: `Credit note against ${i.number}`, confirmLabel: "Issue credit note", fields: [{ name: "amount", label: `Amount (USD), at most ${usd(i.amount_cents)}`, inputMode: "decimal" }, { name: "reason", label: "Reason (shown on the credit note)", multiline: true }] });
    const cents = toUnits(v?.amount ?? "");
    if (!v || !cents || Number.isNaN(cents)) return;
    const reason = v.reason;
    if (reason) act.run(post(`invoices/${i.id}/credit-note`, { amountCents: cents, reason }), `Credit note for ${usd(cents)} issued.`);
  }

  return (
    <div className="grid max-w-6xl gap-6">
      <PageHeader title="Invoices" description="Amounts in USD. Credit notes are negative invoices; issued invoices are never edited."
        actions={<><Button variant="outline" size="sm" disabled={act.busy} onClick={() => act.run(() => api<{ overdue: number }>("invoices/sweep-overdue", { org, body: {} }), (r) => `${r.overdue} invoice(s) marked overdue.`)}>Mark overdue</Button><ExportLink kind="invoices" org={org} /></>} />
      <label className="grid w-48 gap-1 text-sm">Status
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          {["", "issued", "overdue", "paid", "disputed", "credited", "void"].map((s) => <option key={s} value={s}>{s || "All"}</option>)}
        </select>
      </label>
      <Messages error={act.error ?? list.error} notice={act.notice} />
      {list.data?.length === 0 && <Empty>No invoices.</Empty>}
      {!!list.data?.length && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Brand</TableHead><TableHead>For</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.data.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono">{i.number}</TableCell>
                  <TableCell>{i.brand}</TableCell>
                  <TableCell className="max-w-72 text-xs">{i.kind.replace("_", " ")}: {i.basis}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(i.amount_cents)} <span className="text-xs text-muted-foreground">{i.currency}</span></TableCell>
                  <TableCell><Status value={i.status} /></TableCell>
                  <TableCell>{when(i.due_at)}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    {["issued", "overdue"].includes(i.status) && i.kind !== "credit_note" && (
                      <>
                        <Button size="sm" variant="outline" disabled={act.busy} onClick={() => act.run(post(`invoices/${i.id}/paid`), `${i.number} marked paid (sandbox).`)}>Mark paid (sandbox)</Button>
                        <Button size="sm" variant="ghost" disabled={act.busy} onClick={async () => { const reason = await one(`Payment failed: ${i.number}`, "Why did the payment fail?", { confirmLabel: "Notify the brand" }); if (reason) act.run(post(`invoices/${i.id}/payment-failed`, { reason }), "Brand billing contacts were notified."); }}>Payment failed</Button>
                      </>
                    )}
                    {["issued", "overdue", "paid"].includes(i.status) && i.kind !== "credit_note" && <Button size="sm" variant="ghost" disabled={act.busy} onClick={() => credit(i)}>Credit note</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
