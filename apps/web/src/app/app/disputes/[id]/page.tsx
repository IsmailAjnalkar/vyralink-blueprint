"use client";
// One dispute, for every party: claim, evidence thread, decision. Only a platform admin decides.
import { useParams } from "next/navigation";
import { Messages, PageHeader, Status, textareaClass, when } from "@/components/bits";
import { TextField } from "@/components/form";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError, toUnits, usd } from "@/lib/api";
import type { Dispute } from "@/lib/types";
import { useAction, useLoad } from "@/lib/use-load";

const OUTCOME: Record<string, string> = {
  invoice: "Credit to the brand (USD)", cancellation_fee: "Credit to the brand (USD)",
  seller: "Amount added to the seller (USD)", brand: "Amount taken from the held pay (USD, at most what is held)",
};

export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const { me, current } = useSession();
  const org = current?.org_id;
  const d = useLoad(() => api<Dispute & { seller_id: string | null }>(`disputes/${id}`, { org }), `${org}:${id}`);
  const act = useAction(d.reload);
  const x = d.data;

  async function evidence(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const note = String(new FormData(el).get("note")).trim();
    if (note && (await act.run(() => api(`disputes/${id}/evidence`, { org, body: { note } }), "Added."))) el.reset();
  }
  async function decide(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const outcomeCents = toUnits(String(f.get("outcome")) || "0");
    if (outcomeCents == null || Number.isNaN(outcomeCents)) return act.run(() => Promise.reject(new ApiError(400, "Enter the outcome amount like 25.00 (0 for none).")));
    await act.run(() => api(`disputes/${id}/decide`, { org, body: { decision: String(f.get("decision")).trim(), outcomeCents } }), "Decided. Both sides were notified.");
  }

  if (!x) return <Messages error={d.error} />;
  const side = x.invoice_id ? x.type : x.opened_by === x.seller_id ? "seller" : "brand";
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title={`Dispute: ${x.type.replace("_", " ")}`} description={<>Opened {when(x.created_at)} · {usd(x.amount_cents)} · <Status value={x.status} /></>} />
      <Messages error={act.error} notice={act.notice} />
      <Card>
        <CardHeader><CardTitle>Claim</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>{x.claim}</p>
          {x.decision && <p className="rounded-md border p-3"><strong>Decision:</strong> {x.decision} · outcome {usd(x.outcome_cents)}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Evidence</CardTitle><CardDescription>Notes from either side and the platform. Attachments need file storage (not configured yet).</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <ul className="grid gap-2 text-sm">
            {x.evidence.length === 0 && <li className="text-muted-foreground">No evidence yet.</li>}
            {x.evidence.map((ev, i) => <li key={i} className="rounded-md bg-muted/40 p-2">{ev.note}<span className="block text-xs text-muted-foreground">{ev.by === me.user.id ? "You" : "Other party"} · {when(ev.at)}</span></li>)}
          </ul>
          {x.status === "open" && (
            <form onSubmit={evidence} className="grid gap-2">
              <label htmlFor="note" className="text-sm font-medium">Add evidence</label>
              <textarea id="note" name="note" className={textareaClass} required />
              <Button type="submit" size="sm" className="w-fit" disabled={act.busy}>Add</Button>
            </form>
          )}
        </CardContent>
      </Card>
      {x.status === "open" && me.user.is_super_admin && (
        <Card>
          <CardHeader><CardTitle>Decide</CardTitle><CardDescription>Audited. The outcome becomes a credit note or a ledger adjustment; nothing is edited.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={decide} className="grid gap-3">
              <label htmlFor="decision" className="text-sm font-medium">Decision (both sides see it)</label>
              <textarea id="decision" name="decision" className={textareaClass} required />
              <TextField id="outcome" name="outcome" label={OUTCOME[side] ?? "Outcome (USD)"} inputMode="decimal" defaultValue="0" />
              <Button type="submit" className="w-fit" disabled={act.busy}>Decide</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
