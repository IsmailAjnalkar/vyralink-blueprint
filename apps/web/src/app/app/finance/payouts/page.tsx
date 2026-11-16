"use client";
// Payout runs (blueprint F04): build from locked lines, approve (two different people above the limit), send.
// Sending stands in for the payment provider (sandbox) until Stripe Connect is set up; nothing leaves the platform.
import { useState } from "react";
import { Empty, Messages, PageHeader, Status, when } from "@/components/bits";
import { ExportLink } from "@/components/export-link";
import { useSession } from "@/components/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, usd } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Run = { id: string; status: string; total_cents: number; currency: string; approvals: string[]; created_at: string; executed_at: string | null; payouts: number; failed: number };
type Payout = { id: string; seller: string; seller_id: string; amount_cents: number; status: string; failure_reason: string | null; attempts: number };
type Held = { seller: string; amountCents: number; reason: string };

export default function Payouts() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const runs = useLoad(() => api<Run[]>("payout-runs", { org }), org);
  const [open, setOpen] = useState<string | null>(null);
  const [held, setHeld] = useState<Held[]>([]);
  const act = useAction(runs.reload);

  async function build() {
    const r = await act.run(() => api<{ run: Run | null; held: Held[] }>("payout-runs", { org, body: {} }), (x) => (x.run ? `Run created for ${usd(x.run.total_cents)}.` : "Nothing to pay: no locked lines for sellers who can be paid."));
    if (r) { setHeld(r.held); if (r.run) setOpen(r.run.id); }
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="Payout runs" description="A line is claimed by exactly one run, so nobody is paid twice."
        actions={<><Button disabled={act.busy} onClick={build}>Build a payout run</Button><ExportLink kind="payouts" org={org} /></>} />
      <Alert><AlertDescription>Sandbox: no payment provider is connected, so “Send” simulates the provider and records the result. Real payouts need Stripe Connect.</AlertDescription></Alert>
      <Messages error={act.error ?? runs.error} notice={act.notice} />
      {held.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Held back</CardTitle><CardDescription>These sellers stay unpaid until they fix their account; their lines remain locked.</CardDescription></CardHeader>
          <CardContent><ul className="text-sm">{held.map((h) => <li key={h.seller}>{h.seller}: {usd(h.amountCents)} ({h.reason})</li>)}</ul></CardContent>
        </Card>
      )}
      {runs.data?.length === 0 && <Empty>No payout runs yet.</Empty>}
      {runs.data?.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">{usd(r.total_cents)} {r.currency} <Status value={r.status} />{r.failed > 0 && <Status value="failed" />}</CardTitle>
            <CardDescription>{when(r.created_at)} · {r.payouts} seller(s) · {r.approvals.length} approval(s){r.executed_at && ` · sent ${when(r.executed_at)}`}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {r.status === "draft" && <Button size="sm" disabled={act.busy} onClick={() => act.run(() => api<{ status: string; approvals: number; needed: number }>(`payout-runs/${r.id}/approve`, { org, body: {} }), (x) => (x.status === "approved" ? "Approved." : `Approval ${x.approvals} of ${x.needed}: a different person must approve too.`))}>Approve</Button>}
              {r.status === "approved" && <Button size="sm" disabled={act.busy} onClick={() => act.run(() => api<{ paid: number; failed: number }>(`payout-runs/${r.id}/execute`, { org, body: {} }), (x) => `Sent (sandbox): ${x.paid} paid, ${x.failed} failed.`)}>Send (sandbox)</Button>}
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>{open === r.id ? "Hide" : "Show"} payouts</Button>
            </div>
            {open === r.id && <RunPayouts runId={r.id} org={org} onChange={runs.reload} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RunPayouts({ runId, org, onChange }: { runId: string; org: string; onChange: () => unknown }) {
  const run = useLoad(() => api<{ payouts: Payout[] }>(`payout-runs/${runId}`, { org }), runId);
  const act = useAction(() => Promise.all([run.reload(), onChange()]));
  return (
    <>
      <Messages error={act.error ?? run.error} notice={act.notice} />
      <Table>
        <TableHeader><TableRow><TableHead>Seller</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
        <TableBody>
          {run.data?.payouts.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.seller}</TableCell>
              <TableCell className="text-right tabular-nums">{usd(p.amount_cents)}</TableCell>
              <TableCell><Status value={p.status} />{p.failure_reason && <span className="block text-xs">{p.failure_reason}</span>}</TableCell>
              <TableCell>{p.attempts}</TableCell>
              <TableCell>{p.status === "failed" && <Button size="sm" variant="outline" disabled={act.busy} onClick={() => act.run(() => api(`payouts/${p.id}/retry`, { org, body: {} }), "Retried and paid (sandbox).")}>Retry</Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
