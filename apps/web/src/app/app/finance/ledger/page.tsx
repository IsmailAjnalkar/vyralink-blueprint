"use client";
// Seller ledger (blueprint F03): every line names how it was calculated. Adjustments over the approval limit need a
// second person (another finance administrator or a location manager), approving with their own sign-in.
import { useState } from "react";
import { Empty, Messages, PageHeader, Status, selectClass, when } from "@/components/bits";
import { Field, TextField } from "@/components/form";
import { ExportLink } from "@/components/export-link";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError, toUnits, usd } from "@/lib/api";
import type { Booking, LedgerEntry } from "@/lib/types";
import { useAction, useLoad } from "@/lib/use-load";

export default function Ledger() {
  const { me, current } = useSession();
  const org = current?.org_id ?? "";
  const isFinance = current?.role === "finance_admin";
  const [status, setStatus] = useState(isFinance ? "" : "pending_approval");
  const list = useLoad(() => api<LedgerEntry[]>(`ledger${status ? `?status=${status}` : ""}`, { org }), `${org}:${status}`);
  const sessions = useLoad(() => (isFinance ? api<Booking[]>("bookings?status=completed", { org }) : Promise.resolve([])), `${org}:s`);
  const act = useAction(list.reload);

  async function adjust(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const el = e.currentTarget;
    const raw = String(f.get("amount")).trim();
    const cents = toUnits(raw.replace(/^-/, ""));
    if (!cents || Number.isNaN(cents)) return act.run(() => Promise.reject(new ApiError(400, "Enter an amount like 25.00, or -25.00 to deduct.")));
    const amountCents = raw.startsWith("-") ? -cents : cents;
    const r = await act.run(() => api<LedgerEntry>("ledger/adjustments", { org, body: { bookingId: String(f.get("booking")), amountCents, reason: String(f.get("reason")).trim() } }),
      (x) => (x.status === "pending_approval" ? "Saved. Over the approval limit, so a second person must approve it." : "Adjustment added."));
    if (r) el.reset();
  }

  return (
    <div className="grid max-w-6xl gap-6">
      <PageHeader title={isFinance ? "Seller ledger" : "Approvals"} description={isFinance ? "Seller pay is provisional until results lock, then locked, scheduled into a payout run and paid." : "Ledger adjustments waiting for a second approver."}
        actions={isFinance && <ExportLink kind="ledger" org={org} />} />
      <Messages error={act.error ?? list.error} notice={act.notice} />
      {isFinance && (
        <label className="grid w-56 gap-1 text-sm">Status
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            {["", "provisional", "locked", "pending_approval", "on_hold", "scheduled", "paid"].map((s) => <option key={s} value={s}>{s ? s.replace("_", " ") : "All"}</option>)}
          </select>
        </label>
      )}
      {list.data?.length === 0 && <Empty>Nothing here.</Empty>}
      {!!list.data?.length && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Seller</TableHead><TableHead>Type</TableHead><TableHead>How it was calculated</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.data.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{when(l.created_at)}</TableCell>
                  <TableCell>{l.seller}</TableCell>
                  <TableCell>{l.kind.replace("_", " ")}</TableCell>
                  <TableCell className="max-w-80 text-xs">{l.basis}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(l.amount_cents)}</TableCell>
                  <TableCell><Status value={l.status} /></TableCell>
                  <TableCell>{l.status === "pending_approval" && (l.created_by === me.user.id
                    ? <span className="text-xs text-muted-foreground">Needs someone else</span>
                    : <Button size="sm" disabled={act.busy} onClick={() => act.run(() => api(`ledger/adjustments/${l.id}/approve`, { org, body: {} }), "Approved and locked.")}>Approve</Button>)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {isFinance && (
        <Card>
          <CardHeader><CardTitle>Add an adjustment</CardTitle><CardDescription>Goodwill, corrections or deductions. Never edits an existing line.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={adjust} className="grid gap-3 sm:grid-cols-[1fr_10rem_1fr_auto] sm:items-end">
              <Field id="adj-booking" label="Session">
                <select id="adj-booking" name="booking" className={selectClass} required>{sessions.data?.map((b) => <option key={b.id} value={b.id}>{b.campaign} · {when(b.starts_at)}</option>)}</select>
              </Field>
              <TextField id="adj-amount" name="amount" label="Amount (USD)" placeholder="25.00 or -25.00" required />
              <TextField id="adj-reason" name="reason" label="Reason (seller sees it)" required />
              <Button type="submit" disabled={act.busy}>Add</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
