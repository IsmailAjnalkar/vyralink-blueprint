"use client";
// Studio booking page (blueprint O07–O15): producer, confirmation, booth moves, samples, check-in, readiness and the Go.
import Link from "next/link";
import { useParams } from "next/navigation";
import { Empty, Messages, PageHeader, Status, selectClass, when } from "@/components/bits";
import { Field, TextField } from "@/components/form";
import { useSession } from "@/components/shell";
import { SessionResults } from "@/components/settlement";
import { Thread } from "@/components/thread";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Booking, Booth, Shipment } from "@/lib/types";
import { useAction, useLoad } from "@/lib/use-load";

type Member = { id: string; name: string; role: string };
type Ready = { item: string; owner: string; result: string; note: string | null };
type Samples = { received: number; used: number; returned: number; disposed: number; onHand: number; discrepancy: boolean; movements: { id: string; kind: string; qty: number; from_place: string | null; to_place: string | null; at: string }[] };
const LABEL: Record<string, string> = {
  checked_in: "Seller checked in", briefing_acknowledged: "Seller read the briefing", tiktok_logged_in: "TikTok account logged in on the studio device", showcase_ready: "Products in the TikTok showcase",
  camera_audio: "Camera and audio", network: "Network", samples_at_booth: "Samples at the booth", compliance: "Compliance check (claims, disclosures)",
};
const SELLER_ITEMS = new Set(["checked_in", "briefing_acknowledged"]);

export default function StudioBooking() {
  const { id } = useParams<{ id: string }>();
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const role = current?.role ?? "";
  const isManager = role === "location_manager";
  const floor = isManager || role === "producer";
  const k = `${org}:${id}`;
  const b = useLoad(() => api<Booking>(`bookings/${id}`, { org }), k);
  const ready = useLoad(() => api<Ready[]>(`bookings/${id}/readiness`, { org }), k);
  const ships = useLoad(() => api<Shipment[]>(`bookings/${id}/shipments`, { org }), k);
  const samples = useLoad(() => api<Samples>(`bookings/${id}/samples`, { org }), k);
  const members = useLoad(() => api<Member[]>("orgs/current/members", { org }), org);
  const bk = b.data;
  const booths = useLoad(() => (bk ? api<Booth[]>(`locations/${bk.location_id}/booths`, { org }) : Promise.resolve([])), bk?.location_id ?? "");
  const act = useAction(() => Promise.all([b.reload(), ready.reload(), ships.reload(), samples.reload()]));
  const post = <T = unknown,>(path: string, body: unknown = {}) => () => api<T>(path, { org, body });
  const form = (e: React.SubmitEvent<HTMLFormElement>) => { e.preventDefault(); return { f: new FormData(e.currentTarget), el: e.currentTarget }; };
  const upcoming = bk && ["hold", "confirmed"].includes(bk.status);
  const notPassed = ready.data?.filter((r) => r.result !== "pass") ?? [];

  if (!bk) return <Messages error={b.error} />;
  return (
    <div className="grid max-w-5xl gap-6">
      <Link href="/app/studio/bookings" className="text-sm underline">← Bookings</Link>
      <PageHeader title={bk.campaign} description={<>{bk.booth} · {when(bk.starts_at)} – {new Date(bk.ends_at).toLocaleTimeString([], { timeStyle: "short" })} · <Status value={bk.status} /></>} />
      <Messages error={act.error} notice={act.notice} />

      <Card>
        <CardHeader><CardTitle>Session</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Seller arrives</dt><dd>{when(bk.arrival_at)}</dd></div>
            <div><dt className="text-muted-foreground">Seller</dt><dd>{bk.seller_id ? "Contracted" : "Not contracted yet"}</dd></div>
            <div><dt className="text-muted-foreground">Producer</dt><dd>{members.data?.find((m) => m.id === bk.producer_id)?.name ?? "Not assigned"}</dd></div>
            <div><dt className="text-muted-foreground">{bk.status === "hold" ? "Hold expires" : "Checked in"}</dt><dd>{when(bk.status === "hold" ? bk.hold_expires_at : bk.checked_in_at)}</dd></div>
          </dl>
          {isManager && upcoming && (
            <div className="grid gap-4 sm:grid-cols-2">
              <form className="flex items-end gap-2" onSubmit={(e) => { const { f } = form(e); act.run(post(`bookings/${id}/assign-producer`, { producerId: String(f.get("producer")) }), "Producer assigned."); }}>
                <Field id="producer" label="Producer">
                  <select id="producer" name="producer" className={selectClass} defaultValue={bk.producer_id ?? ""} required>
                    <option value="" disabled>Choose a producer</option>
                    {members.data?.filter((m) => m.role === "producer").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
                <Button type="submit" variant="outline" disabled={act.busy}>Assign</Button>
              </form>
              <form className="flex items-end gap-2" onSubmit={(e) => { const { f } = form(e); act.run(post<{ booth: string }>(`bookings/${id}/move`, { boothId: String(f.get("booth")) }), (r) => `Moved to ${r.booth}. Brand, seller and producer were notified.`); }}>
                <Field id="booth" label="Move to booth (same time)">
                  <select id="booth" name="booth" className={selectClass} required defaultValue="">
                    <option value="" disabled>Choose a booth</option>
                    {booths.data?.filter((x) => x.id !== bk.booth_id && x.status === "available").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </Field>
                <Button type="submit" variant="outline" disabled={act.busy}>Move</Button>
              </form>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {isManager && bk.status === "hold" && <Button disabled={act.busy} onClick={() => act.run(post(`bookings/${id}/confirm`), "Confirmed. The campaign is scheduled and everyone was notified.")}>Confirm booking</Button>}
            {isManager && bk.status === "confirmed" && <Button variant="destructive" disabled={act.busy} onClick={() => confirm(`Record a no-show? It counts ${bk.no_show_min} minutes after the arrival time.`) && act.run(post<{ sellerPaused: boolean }>(`bookings/${id}/no-show`), (r) => `No-show recorded.${r.sellerPaused ? " The seller is paused after two no-shows." : ""}`)}>Record no-show</Button>}
          </div>
        </CardContent>
      </Card>

      {floor && bk.status === "confirmed" && (
        <Card>
          <CardHeader><CardTitle>Front desk check-in</CardTitle><CardDescription>Ask the seller for the code on their phone. Opens {bk.checkin_open_min} minutes before arrival.</CardDescription></CardHeader>
          <CardContent>
            <form className="flex items-end gap-2" onSubmit={(e) => { const { f } = form(e); act.run(post<{ late: boolean }>(`bookings/${id}/check-in`, { code: String(f.get("code")) }), (r) => (r.late ? "Checked in (late)." : "Checked in.")); }}>
              <TextField id="code" name="code" label="Check-in code" placeholder="VL-1234" autoComplete="off" required />
              <Button type="submit" disabled={act.busy}>Check in</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {ready.data && ready.data.some((r) => r.result !== "pending" || bk.status !== "hold") && (
        <Card>
          <CardHeader><CardTitle>Readiness</CardTitle><CardDescription>Every item must pass before the Go. A Location Manager can override with a reason.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            <ul className="grid gap-2">
              {ready.data.map((r) => (
                <li key={r.item} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="min-w-64 flex-1">{LABEL[r.item] ?? r.item} <span className="text-xs text-muted-foreground">({r.owner})</span>{r.note && <span className="block text-xs">{r.note}</span>}</span>
                  <Status value={r.result === "pass" ? "passed" : r.result === "fail" ? "failed" : "pending"} />
                  {floor && !SELLER_ITEMS.has(r.item) && ["confirmed", "checked_in"].includes(bk.status) && (
                    <>
                      <Button size="sm" variant="outline" aria-label={`Pass: ${LABEL[r.item]}`} disabled={act.busy} onClick={() => act.run(post(`bookings/${id}/readiness/${r.item}`, { result: "pass" }))}>Pass</Button>
                      <Button size="sm" variant="ghost" aria-label={`Fail: ${LABEL[r.item]}`} disabled={act.busy} onClick={() => { const note = prompt("What failed?"); if (note) act.run(post(`bookings/${id}/readiness/${r.item}`, { result: "fail", note }), "Marked failed; the location manager was notified."); }}>Fail</Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {floor && bk.status === "checked_in" && !bk.go_at && (
              notPassed.length === 0
                ? <Button className="w-fit" disabled={act.busy} onClick={() => act.run(post(`bookings/${id}/go`), "Go given. The seller was told to start the LIVE in the TikTok app when cued.")}>Give the Go</Button>
                : isManager && <Button variant="outline" className="w-fit" disabled={act.busy} onClick={() => { const overrideReason = prompt(`Not passed: ${notPassed.map((r) => LABEL[r.item]).join(", ")}. Reason to go anyway?`); if (overrideReason) act.run(post(`bookings/${id}/go`, { overrideReason }), "Go given with override (audited)."); }}>Override and give the Go</Button>
            )}
            {bk.go_at && <p className="text-sm">Go given {when(bk.go_at)}. The LIVE itself is started and ended in TikTok on the studio device.</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Sample shipments</CardTitle><CardDescription>Brands ship samples to arrive before the cutoff ({bk.sample_cutoff_hours} h before the LIVE).</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <Messages error={ships.error} />
          {ships.data?.length === 0 && <Empty>No shipments announced yet.</Empty>}
          {ships.data?.map((s) => (
            <div key={s.id} className="grid gap-2 rounded-md border p-3 text-sm">
              <p><span className="font-medium">{s.product}</span> · {s.expected_qty} expected{s.tracking && ` · tracking ${s.tracking}`} · <Status value={s.overdue ? "overdue" : s.status} />{s.received_qty != null && ` · received ${s.received_qty} (${s.condition}) on shelf ${s.shelf}`}</p>
              {s.status === "expected" && ["inventory", "location_manager"].includes(role) && (
                <form className="grid gap-2 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end" onSubmit={(e) => { const { f } = form(e); act.run(post<{ status: string }>(`shipments/${s.id}/receive`, { receivedQty: Number(f.get("qty")), condition: String(f.get("condition")), shelf: String(f.get("shelf")).trim() }), (r) => (r.status === "received" ? "Received." : "Recorded as short; the brand was asked to resend.")); }}>
                  <TextField id={`qty-${s.id}`} name="qty" label="Received" type="number" min={0} defaultValue={String(s.expected_qty)} required />
                  <Field id={`cond-${s.id}`} label="Condition"><select id={`cond-${s.id}`} name="condition" className={selectClass}><option value="good">Good</option><option value="damaged">Damaged</option><option value="opened">Opened</option></select></Field>
                  <TextField id={`shelf-${s.id}`} name="shelf" label="Shelf" placeholder="S2" required />
                  <Button type="submit" size="sm" disabled={act.busy}>Receive</Button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {samples.data && (
        <Card>
          <CardHeader><CardTitle>Samples on hand: {samples.data.onHand}</CardTitle><CardDescription>Received {samples.data.received} · used {samples.data.used} · returned {samples.data.returned} · disposed {samples.data.disposed}{samples.data.discrepancy && " · counts don’t balance after the session"}</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {samples.data.movements.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Movement</TableHead><TableHead>Qty</TableHead><TableHead>From → to</TableHead></TableRow></TableHeader>
                <TableBody>{samples.data.movements.map((m) => <TableRow key={m.id}><TableCell>{when(m.at)}</TableCell><TableCell>{m.kind}</TableCell><TableCell>{m.qty}</TableCell><TableCell>{m.from_place ?? "—"} → {m.to_place ?? "—"}</TableCell></TableRow>)}</TableBody>
              </Table>
            )}
            {["inventory", "producer", "location_manager"].includes(role) && (
              <form className="grid gap-2 sm:grid-cols-[10rem_6rem_1fr_1fr_auto] sm:items-end" onSubmit={(e) => { const { f, el } = form(e); act.run(post(`bookings/${id}/samples`, { kind: String(f.get("kind")), qty: Number(f.get("qty")), from: String(f.get("from")).trim() || undefined, to: String(f.get("to")).trim() || undefined }), "Recorded.").then((r) => r && el.reset()); }}>
                <Field id="mv-kind" label="Movement"><select id="mv-kind" name="kind" className={selectClass}><option value="moved">Moved</option><option value="used">Used on LIVE</option><option value="returned">Returned to brand</option><option value="disposed">Disposed</option></select></Field>
                <TextField id="mv-qty" name="qty" label="Qty" type="number" min={1} defaultValue="1" required />
                <TextField id="mv-from" name="from" label="From" placeholder="S2" />
                <TextField id="mv-to" name="to" label="To" placeholder="Booth" />
                <Button type="submit" size="sm" disabled={act.busy}>Record</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {bk.status === "completed" && <SessionResults bookingId={bk.id} org={org} canImport={floor || role === "finance_admin"} />}
      {["checked_in", "in_progress"].includes(bk.status) && <p className="text-sm"><Link className="underline" href="/app/studio/live">Run this session from the LIVE control center →</Link></p>}
      <Thread campaignId={bk.campaign_id} org={org} />
    </div>
  );
}
