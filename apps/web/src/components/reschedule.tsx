// Two-party reschedule of a confirmed session: one side proposes a new time, the other accepts or declines.
// The server re-checks the booth, producer and seller on accept, so a clash is refused with the reason.
import { Messages, Status, when } from "@/components/bits";
import { TextField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Request = { id: string; side: "brand" | "seller"; starts_at: string; ends_at: string; reason: string; status: string; requested_by_name: string; note: string | null };
const local = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const span = (r: { starts_at: string; ends_at: string }) => `${when(r.starts_at)} – ${new Date(r.ends_at).toLocaleTimeString([], { timeStyle: "short" })}`;

export function Reschedule({ bookingId, org, side, canAct, startsAt, endsAt, onDone }: {
  bookingId: string; org?: string; side: "brand" | "seller"; canAct: boolean; startsAt: string; endsAt: string; onDone?: () => unknown;
}) {
  const list = useLoad(() => api<Request[]>(`bookings/${bookingId}/reschedule-requests`, { org }), `rr:${bookingId}`);
  const act = useAction(() => Promise.all([list.reload(), onDone?.()]));
  const pending = list.data?.find((r) => r.status === "pending");
  const last = list.data?.find((r) => r.status !== "pending");
  const decide = (decision: "accept" | "decline" | "withdraw", msg: string) =>
    act.run(() => api(`reschedule-requests/${pending!.id}/decision`, { org, body: { decision } }), msg);

  async function propose(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const f = new FormData(el);
    const body = { startsAt: new Date(String(f.get("start"))).toISOString(), endsAt: new Date(String(f.get("end"))).toISOString(), reason: String(f.get("reason")).trim() };
    if (await act.run(() => api(`bookings/${bookingId}/reschedule-requests`, { org, body }), `Proposed. The ${side === "brand" ? "seller" : "brand"} decides.`)) el.reset();
  }

  return (
    <section aria-labelledby={`rr-${bookingId}`} className="grid gap-2">
      <h3 id={`rr-${bookingId}`} className="text-sm font-semibold">Change the time</h3>
      <Messages error={act.error ?? list.error} notice={act.notice} />
      {pending ? (
        <div className="grid gap-2 rounded-md border p-3 text-sm">
          <p><strong>Proposed:</strong> {span(pending)} <span className="text-muted-foreground">by {pending.requested_by_name} ({pending.side})</span></p>
          <p><strong>Why:</strong> {pending.reason}</p>
          {pending.side === side ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Waiting for the {side === "brand" ? "seller" : "brand"} to answer.</span>
              {canAct && <Button size="sm" variant="outline" disabled={act.busy} onClick={() => decide("withdraw", "Proposal withdrawn.")}>Withdraw</Button>}
            </div>
          ) : canAct ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={act.busy} onClick={() => decide("accept", "Accepted. The session moved; everyone involved was told.")}>Accept new time</Button>
              <Button size="sm" variant="outline" disabled={act.busy} onClick={() => decide("decline", "Declined. The session keeps its time.")}>Decline</Button>
            </div>
          ) : <p className="text-muted-foreground">The brand owner answers this.</p>}
        </div>
      ) : canAct ? (
        <details className="rounded-md border p-3 text-sm">
          <summary className="cursor-pointer">Propose a new time</summary>
          <form onSubmit={propose} className="mt-3 grid gap-2 sm:grid-cols-2 sm:items-end">
            <TextField id={`rr-start-${bookingId}`} name="start" label="New start" type="datetime-local" defaultValue={local(startsAt)} required />
            <TextField id={`rr-end-${bookingId}`} name="end" label="New end" type="datetime-local" defaultValue={local(endsAt)} required />
            <TextField id={`rr-reason-${bookingId}`} name="reason" label="Why the time needs to change" required />
            <Button type="submit" size="sm" variant="outline" disabled={act.busy} className="w-fit">Send proposal</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">The other side accepts or declines. The signed contract stays as it is; the accepted proposal is the agreed change.</p>
        </details>
      ) : null}
      {last && !pending && <p className="text-xs text-muted-foreground">Last proposal ({span(last)}): <Status value={last.status} /></p>}
    </section>
  );
}
