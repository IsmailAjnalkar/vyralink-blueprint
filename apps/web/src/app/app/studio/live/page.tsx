"use client";
import { useAsk } from "@/components/ask";
// LIVE control center (blueprint O16–O20): today's sessions pushed in real time (server-sent events), most urgent first.
// Every figure shows its source. Vyralink does not control TikTok: start/end happen in the TikTok app on the studio device.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, Messages, PageHeader, Status, selectClass, textareaClass, when } from "@/components/bits";
import { Field, TextField } from "@/components/form";
import { useSession } from "@/components/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError, toUnits, usd } from "@/lib/api";
import type { Location } from "@/lib/types";
import { useAction, useLoad } from "@/lib/use-load";

type Figure = { value: number | null; source: string; asOf?: string };
type Incident = { id: string; severity: string; description: string; status: string };
type Session = {
  id: string; status: string; starts_at: string; ends_at: string; actual_start: string | null; go_at: string | null; booth: string; campaign: string; brand: string; host: string | null; producer: string | null;
  readiness: string; connection: Figure; viewers: Figure; orders: Figure; gmvCents: Figure; gmvPerHourCents: Figure; open_incidents: Incident[];
};
type Board = { note: string; sessions: Session[] };

/** Subscribes to the location's control-center stream; EventSource reconnects on its own after a drop. */
function useBoard(locId: string, org: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [state, setState] = useState<"connecting" | "live" | "reconnecting">("connecting");
  useEffect(() => {
    if (!locId) return;
    const es = new EventSource(`/api/locations/${locId}/control-center/stream?org=${org}`);
    es.onmessage = (e) => { setBoard(JSON.parse(e.data)); setState("live"); };
    es.onerror = () => setState("reconnecting");
    return () => es.close();
  }, [locId, org]);
  return { board, state };
}

const fig = (f: Figure, money = false) => (f.value == null ? "—" : money ? usd(f.value) : String(f.value));

export default function ControlCenter() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const locs = useLoad(() => api<Location[]>("locations", { org }).then((ls) => ls.filter((l) => l.org_id === org)), org);
  const [sel, setSel] = useState("");
  const locId = sel || locs.data?.[0]?.id || "";
  const { board, state } = useBoard(locId, org);
  const act = useAction();

  if (current?.kind !== "operator") return <PageHeader title="LIVE control center" description="Creator Hub staff only." />;
  return (
    <div className="grid max-w-6xl gap-6">
      <PageHeader title="LIVE control center" description={<span role="status" aria-live="polite">Updates: <Badge variant={state === "live" ? "default" : "outline"}>{state === "live" ? "live" : state}</Badge></span>}
        actions={(locs.data?.length ?? 0) > 1 && (
          <select aria-label="Location" className={`${selectClass} w-56`} value={locId} onChange={(e) => setSel(e.target.value)}>
            {locs.data!.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )} />
      {board && <Alert><AlertDescription>{board.note}</AlertDescription></Alert>}
      <Messages error={act.error ?? locs.error} notice={act.notice} />
      {board?.sessions.length === 0 && <Empty>No confirmed or running sessions today or tomorrow.</Empty>}
      <ul className="grid gap-4 lg:grid-cols-2">
        {board?.sessions.map((s) => <li key={s.id}><SessionCard s={s} org={org} act={act} /></li>)}
      </ul>
    </div>
  );
}

function SessionCard({ s, org, act }: { s: Session; org: string; act: ReturnType<typeof useAction> }) {
  const [panel, setPanel] = useState<"" | "metric" | "incident" | "close">("");
  const { ask, confirm: confirmDialog } = useAsk();
  const post = (path: string, body: unknown = {}) => () => api(`bookings/${s.id}/${path}`, { org, body });
  const high = s.open_incidents.some((i) => i.severity === "high");
  const running = s.status === "in_progress";

  function metric(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const gmvCents = toUnits(String(f.get("gmv")));
    const orders = Number(f.get("orders"));
    if (gmvCents == null || Number.isNaN(gmvCents) || !Number.isInteger(orders) || orders < 0) return act.run(() => Promise.reject(new ApiError(400, "Enter orders as a whole number and GMV like 2560.00, as shown in TikTok Shop.")));
    act.run(post("metrics", { orders, gmvCents, asOf: new Date().toISOString() }), "Recorded (Manual).").then((r) => r && setPanel(""));
  }
  async function incident(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const emergencyStop = f.get("stop") === "on";
    if (emergencyStop && !(await confirmDialog("Send an emergency stop?", "The seller, brand and location manager are told to end the LIVE in the TikTok app now.", "Send emergency stop", true))) return;
    act.run(post("incidents", { category: String(f.get("category")), severity: emergencyStop ? "high" : String(f.get("severity")), description: String(f.get("description")).trim(), emergencyStop }),
      emergencyStop ? "Emergency stop sent: the seller, brand and location manager were notified. End the LIVE in TikTok now." : "Incident opened.").then((r) => r && setPanel(""));
  }
  function closeout(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    act.run(() => api<{ liveMinutes: number; basePayCents: number }>(`bookings/${s.id}/closeout`, { org, body: { partial: f.get("partial") === "on", notes: String(f.get("notes")).trim() || undefined } }),
      (r) => `Closed out: ${Math.floor(r.liveMinutes / 60)} h ${r.liveMinutes % 60} min LIVE, seller base pay ${usd(r.basePayCents)}. Import the TikTok Shop order report from the booking page.`);
  }

  return (
    <Card className={high ? "border-destructive" : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">{s.campaign} <Status value={s.status} />{high && <Badge variant="destructive">high incident</Badge>}</CardTitle>
        <CardDescription>{s.brand} · {s.booth} · host {s.host ?? "—"} · producer {s.producer ?? "—"} · {when(s.starts_at)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <dl className="grid grid-cols-3 gap-2">
          {([["Orders", fig(s.orders), s.orders], ["GMV", fig(s.gmvCents, true), s.gmvCents], ["GMV / hour", fig(s.gmvPerHourCents, true), s.gmvPerHourCents], ["Viewers", fig(s.viewers), s.viewers], ["Connection", fig(s.connection), s.connection], ["Readiness", s.readiness, null]] as [string, string, Figure | null][]).map(([k, v, f]) => (
            <div key={k} className="rounded-md bg-muted/40 p-2">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
              {f && <dd className="text-[11px] text-muted-foreground">{f.source}{f.asOf && ` · ${new Date(f.asOf).toLocaleTimeString([], { timeStyle: "short" })}`}</dd>}
            </div>
          ))}
        </dl>
        {s.open_incidents.length > 0 && (
          <ul className="grid gap-1">
            {s.open_incidents.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <Badge variant={i.severity === "high" ? "destructive" : "outline"}>{i.severity}</Badge><span className="flex-1">{i.description}</span><Status value={i.status} />
                <Button size="sm" variant="outline" disabled={act.busy} onClick={async () => {
                  const v = await ask({ title: "Resolve incident", description: i.description, confirmLabel: "Resolve", fields: [{ name: "resolution", label: "How was it resolved?", multiline: true }, { name: "minutes", label: "Minutes of LIVE lost (0 if none)", defaultValue: "0", inputMode: "numeric" }] });
                  if (!v) return;
                  const resolution = v.resolution;
                  const minutesLost = Number(v.minutes);
                  act.run(() => api(`incidents/${i.id}`, { method: "PATCH", org, body: { status: "resolved", resolution, minutesLost: Number.isInteger(minutesLost) && minutesLost >= 0 ? minutesLost : 0 } }), "Incident resolved.");
                }}>Resolve</Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {s.status === "checked_in" && (s.go_at
            ? <Button size="sm" disabled={act.busy} onClick={() => act.run(post("start"), "LIVE started (timer on). The seller starts the stream in the TikTok app.")}>Mark LIVE started</Button>
            : <Button size="sm" variant="outline" asChild><Link href={`/app/studio/bookings/${s.id}`}>Readiness ({s.readiness})</Link></Button>)}
          {running && <Button size="sm" variant="outline" onClick={() => setPanel(panel === "metric" ? "" : "metric")} aria-expanded={panel === "metric"}>Enter numbers</Button>}
          {["checked_in", "in_progress"].includes(s.status) && <Button size="sm" variant="outline" onClick={() => setPanel(panel === "incident" ? "" : "incident")} aria-expanded={panel === "incident"}>Report incident</Button>}
          {running && <Button size="sm" variant="outline" onClick={() => setPanel(panel === "close" ? "" : "close")} aria-expanded={panel === "close"}>Close out</Button>}
          <Button size="sm" variant="ghost" asChild><Link href={`/app/studio/bookings/${s.id}`}>Booking</Link></Button>
        </div>
        {panel === "metric" && (
          <form onSubmit={metric} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField id={`orders-${s.id}`} name="orders" label="Orders (from TikTok Shop)" type="number" min={0} required />
            <TextField id={`gmv-${s.id}`} name="gmv" label="GMV (USD)" inputMode="decimal" required />
            <Button type="submit" size="sm" disabled={act.busy}>Save</Button>
            <p className="text-xs text-muted-foreground sm:col-span-3">Shown as “Manual”. Payouts use the imported TikTok Shop report, never these numbers.</p>
          </form>
        )}
        {panel === "incident" && (
          <form onSubmit={incident} className="grid gap-2 rounded-md border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field id={`cat-${s.id}`} label="Category"><select id={`cat-${s.id}`} name="category" className={selectClass}>{["technical", "connection", "compliance", "seller", "safety", "platform"].map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
              <Field id={`sev-${s.id}`} label="Severity"><select id={`sev-${s.id}`} name="severity" className={selectClass} defaultValue="medium"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field>
            </div>
            <label htmlFor={`desc-${s.id}`} className="text-sm font-medium">What happened</label>
            <textarea id={`desc-${s.id}`} name="description" required className={textareaClass} />
            <label className="flex items-center gap-2 text-sm font-medium text-destructive"><input type="checkbox" name="stop" /> Emergency stop (ask the seller to end the LIVE in TikTok)</label>
            <Button type="submit" size="sm" variant="destructive" className="w-fit" disabled={act.busy}>Open incident</Button>
          </form>
        )}
        {panel === "close" && (
          <form onSubmit={closeout} className="grid gap-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Close out after the seller ends the LIVE in TikTok. LIVE time comes from the studio log minus minutes lost to incidents.</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="partial" /> Ended early (partial session)</label>
            <label htmlFor={`notes-${s.id}`} className="text-sm font-medium">Notes</label>
            <textarea id={`notes-${s.id}`} name="notes" className={textareaClass} />
            <Button type="submit" size="sm" className="w-fit" disabled={act.busy}>Close out session</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
