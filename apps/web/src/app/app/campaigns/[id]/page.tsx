"use client";
// Campaign page (blueprint B08, B12–B14, B17): lifecycle actions, studio hold, seller invitations, contracts and messages.
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Empty, Messages, PageHeader, Status, when } from "@/components/bits";
import { TextField } from "@/components/form";
import { useSession } from "@/components/shell";
import { SessionResults } from "@/components/settlement";
import { Thread } from "@/components/thread";
import type { Product } from "@/components/product-form";
import { Field } from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, pct, toUnits, usd } from "@/lib/api";
import type { Campaign, Shipment } from "@/lib/types";
import { useAction, useLoad } from "@/lib/use-load";

type Invitation = { id: string; seller_id: string; display_name: string; kind: string; status: string; terms: { baseRateCents: number }; counter: { baseRateCents: number; message: string | null } | null; message: string | null; decline_reason: string | null; expires_at: string };
type Contract = { id: string; version: number; void: boolean; brand_signed_at: string | null; seller_signed_at: string | null };
type Booking = { id: string; booth: string; starts_at: string; ends_at: string; status: string; hold_expires_at: string | null };
type Detail = Campaign & { invitations: Invitation[]; contracts: Contract[]; bookings: Booking[] };
type Availability = { booth_id: string; booth: string; booth_status: string; busy: { from: string; to: string; status: string }[] };
type Location = { id: string; name: string };

const OPEN_INVITE = ["invited", "viewed", "countered", "applied"];

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const created = useSearchParams().get("created");
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const isOwner = current?.role === "brand_owner";
  const d = useLoad(() => api<Detail>(`campaigns/${id}`, { org }), `${org}:${id}`);
  const act = useAction(d.reload);
  const [quote, setQuote] = useState<{ feeCents: number; hoursBefore: number; policy: string } | null>(null);
  const c = d.data;
  const post = <T = unknown,>(path: string, body: unknown = {}) => () => api<T>(path, { org, body });

  const activeBooking = c?.bookings.find((b) => ["hold", "confirmed", "checked_in", "in_progress"].includes(b.status));
  const canHold = c && ["draft", "pending_approval", "published", "recruiting"].includes(c.status) && !activeBooking;

  return (
    <div className="grid max-w-5xl gap-6">
      <Link href="/app/campaigns" className="text-sm underline">← Campaigns</Link>
      <PageHeader title={c?.name ?? "Campaign"} description={c && <>{when(c.starts_at)} – {new Date(c.ends_at).toLocaleTimeString([], { timeStyle: "short" })} · <Status value={c.status} /></>}
        actions={c && (
          <>
            {c.status === "draft" && <Button disabled={act.busy} onClick={() => act.run(post<{ status: string }>(`campaigns/${id}/publish`), (r) => (r.status === "pending_approval" ? "Sent to your Brand Owner for approval (budget is over the approval threshold)." : "Published. Sellers can now find and apply to it."))}>Publish</Button>}
            {c.status === "pending_approval" && isOwner && (
              <>
                <Button disabled={act.busy} onClick={() => act.run(post(`campaigns/${id}/approve`), "Approved and published.")}>Approve</Button>
                <Button variant="outline" disabled={act.busy} onClick={() => { const note = prompt("What should change?"); if (note) act.run(post(`campaigns/${id}/decline`, { note }), "Sent back to draft."); }}>Decline</Button>
              </>
            )}
            {isOwner && !["cancelled", "completed", "archived", "in_progress"].includes(c.status) && (
              <Button variant="destructive" disabled={act.busy} onClick={() => act.run(() => api<{ quote: NonNullable<typeof quote> }>(`campaigns/${id}/cancel`, { org, body: { confirm: false } }).then((r) => setQuote(r.quote)))}>Cancel campaign…</Button>
            )}
          </>
        )} />
      {created && <Messages notice="Draft saved. Next: publish it, hold a studio booth and invite sellers." />}
      <Messages error={act.error ?? d.error} notice={act.notice} />
      {c?.approval_note && c.status === "draft" && <Alert><AlertDescription><strong>Brand Owner note:</strong> {c.approval_note}</AlertDescription></Alert>}

      {quote && (
        <Alert variant="destructive" role="alertdialog" aria-labelledby="cancel-title">
          <AlertTitle id="cancel-title">Cancel {c?.name}?</AlertTitle>
          <AlertDescription className="grid gap-2">
            <p>Cancellation fee: <strong>{usd(quote.feeCents)}</strong> ({quote.hoursBefore} h before the LIVE). {quote.policy}.</p>
            <p>Open invitations are withdrawn and the studio booking is released.</p>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={() => act.run(post<{ feeCents: number }>(`campaigns/${id}/cancel`, { confirm: true }), (r) => `Cancelled. Fee charged: ${usd(r.feeCents)}.`).then(() => setQuote(null))}>Yes, cancel</Button>
              <Button variant="outline" size="sm" onClick={() => setQuote(null)}>Keep it</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {c && (
        <Card>
          <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              {[["Seller base rate", usd(c.base_rate_cents)], ["Seller commission", pct(c.commission_bps)], ["Bonus", c.bonus_cents ? `${usd(c.bonus_cents)} at ${usd(c.bonus_gmv_threshold_cents)} GMV` : "—"], ["Production fee", usd(c.production_fee_cents)],
                ["Performance fee", pct(c.performance_fee_bps)], ["Budget cap", usd(c.budget_cap_cents)], ["Target GMV", usd(c.target_gmv_cents)], ["Training", c.required_courses.join(", ") || "None"]].map(([k, v]) => (
                <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {c && (
        <Card>
          <CardHeader>
            <CardTitle>Studio time</CardTitle>
            <CardDescription>A hold keeps the booth for you while you contract a seller. It becomes a booking when both sides sign and the studio confirms.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {c.bookings.length > 0 && (
              <ul className="grid gap-1 text-sm">
                {c.bookings.map((b) => <li key={b.id}>{b.booth}: <Status value={b.status} />{b.status === "hold" && b.hold_expires_at && <> · hold expires {when(b.hold_expires_at)}</>}</li>)}
              </ul>
            )}
            {activeBooking && <BookingTools booking={activeBooking} campaign={c} org={org} isOwner={isOwner} canReschedule={!c.contracts.some((k) => !k.void)} onDone={d.reload} />}
            {canHold && <HoldPicker campaign={c} org={org} onHold={(boothId) => act.run(post(`campaigns/${id}/hold`, { boothId }), "Booth held.")} busy={act.busy} />}
          </CardContent>
        </Card>
      )}

      {c && (
        <Card>
          <CardHeader>
            <CardTitle>Sellers</CardTitle>
            <CardDescription>Invite sellers from discovery, or accept applications. The first contract both sides sign books the seller.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {["published", "recruiting"].includes(c.status) && <Button asChild variant="outline" className="w-fit"><Link href={`/app/sellers?campaign=${c.id}`}>Find sellers to invite</Link></Button>}
            {c.invitations.length === 0 ? <Empty>No invitations or applications yet.</Empty> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Seller</TableHead><TableHead>Type</TableHead><TableHead>Base rate</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {c.invitations.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.display_name}{i.message && <p className="text-xs font-normal text-muted-foreground">“{i.message}”</p>}</TableCell>
                        <TableCell>{i.kind}</TableCell>
                        <TableCell>{usd(i.terms.baseRateCents)}{i.counter && <p className="text-xs">Counter: <strong>{usd(i.counter.baseRateCents)}</strong>{i.counter.message && ` “${i.counter.message}”`}</p>}</TableCell>
                        <TableCell><Status value={i.status} />{i.decline_reason && <p className="text-xs">{i.decline_reason}</p>}</TableCell>
                        <TableCell className="space-x-1 whitespace-nowrap">
                          {i.status === "applied" && <Button size="sm" disabled={act.busy} onClick={() => act.run(post(`invitations/${i.id}/accept-application`), `Accepted ${i.display_name}. The contract is ready to sign.`)}>Accept</Button>}
                          {i.status === "countered" && (
                            <>
                              <Button size="sm" disabled={act.busy} onClick={() => act.run(post(`invitations/${i.id}/respond`, { accept: true }), "Counter accepted. The contract is ready to sign.")}>Accept counter</Button>
                              <Button size="sm" variant="outline" disabled={act.busy} onClick={() => {
                                const cents = toUnits(prompt("New base rate (USD)") ?? "");
                                if (cents && !Number.isNaN(cents)) act.run(post(`invitations/${i.id}/respond`, { accept: false, baseRateCents: cents }), "New terms sent.");
                              }}>New terms</Button>
                            </>
                          )}
                          {OPEN_INVITE.includes(i.status) && <Button size="sm" variant="ghost" disabled={act.busy} onClick={() => act.run(post(`invitations/${i.id}/withdraw`), "Withdrawn.")}>Withdraw</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {c.contracts.length > 0 && (
              <ul className="grid gap-1 text-sm">
                {c.contracts.map((k) => (
                  <li key={k.id}>
                    <Link className="underline" href={`/app/contracts/${k.id}`}>Contract v{k.version}</Link>{" "}
                    {k.void ? <Status value="void" /> : <>brand {k.brand_signed_at ? "signed" : "to sign"} · seller {k.seller_signed_at ? "signed" : "to sign"}</>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {c?.bookings.some((b) => b.status === "completed") && <Button asChild variant="outline" className="w-fit"><Link href={`/app/campaigns/${c.id}/report`}>Campaign report</Link></Button>}
      {c?.bookings.filter((b) => b.status === "completed").map((b) => <SessionResults key={b.id} bookingId={b.id} org={org} canImport={false} />)}
      {c && <Thread campaignId={c.id} org={org} />}
    </div>
  );
}

/** Brand side of a booking: ship samples to the studio; move a held slot to another time. */
function BookingTools({ booking, campaign, org, isOwner, canReschedule, onDone }: { booking: Booking; campaign: Campaign; org: string; isOwner: boolean; canReschedule: boolean; onDone: () => unknown }) {
  const ships = useLoad(() => api<Shipment[]>(`bookings/${booking.id}/shipments`, { org }), booking.id);
  const products = useLoad(() => api<Product[]>("products", { org }).then((ps) => ps.filter((p) => campaign.product_ids.includes(p.id))), `${org}:${campaign.id}`);
  const act = useAction(() => Promise.all([ships.reload(), onDone()]));
  const local = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

  async function ship(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const el = e.currentTarget;
    const r = await act.run(() => api(`bookings/${booking.id}/shipments`, { org, body: { productId: String(f.get("product")), expectedQty: Number(f.get("qty")), tracking: String(f.get("tracking")).trim() || undefined } }), "Shipment announced to the studio.");
    if (r) el.reset();
  }
  async function reschedule(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const startsAt = new Date(String(f.get("start"))).toISOString();
    const endsAt = new Date(String(f.get("end"))).toISOString();
    await act.run(() => api(`bookings/${booking.id}/reschedule`, { org, body: { startsAt, endsAt } }), "Moved. Open invitations were told about the new time.");
  }

  return (
    <div className="grid gap-4 rounded-md border p-3">
      <Messages error={act.error ?? ships.error} notice={act.notice} />
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">Samples</h3>
        {ships.data?.map((s) => <p key={s.id} className="text-sm">{s.product}: {s.expected_qty} sent{s.tracking && ` (${s.tracking})`} · <Status value={s.overdue ? "overdue" : s.status} />{s.received_qty != null && ` · studio received ${s.received_qty}, ${s.condition}`}</p>)}
        {ships.data?.[0] && <p className="text-xs text-muted-foreground">Due at the studio by {when(ships.data[0].cutoff)}.</p>}
        <form onSubmit={ship} className="grid gap-2 sm:grid-cols-[1fr_6rem_1fr_auto] sm:items-end">
          <Field id="ship-product" label="Product">
            <select id="ship-product" name="product" required className="h-9 rounded-md border bg-background px-2 text-sm">{products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </Field>
          <TextField id="ship-qty" name="qty" label="Quantity" type="number" min={1} defaultValue="4" required />
          <TextField id="ship-tracking" name="tracking" label="Tracking number" />
          <Button type="submit" size="sm" disabled={act.busy}>Announce shipment</Button>
        </form>
      </div>
      {booking.status === "hold" && isOwner && (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Reschedule the hold</h3>
          {canReschedule ? (
            <form onSubmit={reschedule} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <TextField id="rs-start" name="start" label="New start" type="datetime-local" defaultValue={local(campaign.starts_at)} required />
              <TextField id="rs-end" name="end" label="New end" type="datetime-local" defaultValue={local(campaign.ends_at)} required />
              <Button type="submit" size="sm" variant="outline" disabled={act.busy}>Move hold</Button>
            </form>
          ) : <p className="text-sm text-muted-foreground">A contract already states this time. To change it, cancel and book again.</p>}
        </div>
      )}
    </div>
  );
}

function HoldPicker({ campaign, org, onHold, busy }: { campaign: Campaign; org: string; onHold: (boothId: string) => unknown; busy: boolean }) {
  const [loc, setLoc] = useState(campaign.location_id ?? "");
  const locations = useLoad(() => api<Location[]>("locations", { org }), org);
  const from = new Date(new Date(campaign.starts_at).getTime() - 3 * 3.6e6).toISOString();
  const to = new Date(new Date(campaign.ends_at).getTime() + 3 * 3.6e6).toISOString();
  const avail = useLoad(() => (loc ? api<Availability[]>(`locations/${loc}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { org }) : Promise.resolve([])), `${loc}:${from}`);
  const start = new Date(campaign.starts_at).getTime();
  const end = new Date(campaign.ends_at).getTime();
  const clash = (a: Availability) => a.busy.some((b) => new Date(b.from).getTime() < end && new Date(b.to).getTime() > start);

  return (
    <div className="grid gap-3">
      <TextField id="hold-window" label="Session" value={`${when(campaign.starts_at)} – ${new Date(campaign.ends_at).toLocaleTimeString([], { timeStyle: "short" })}`} readOnly />
      <div className="grid gap-1.5">
        <label htmlFor="hold-loc" className="text-sm font-medium">Studio</label>
        <select id="hold-loc" className="h-9 rounded-md border bg-background px-2 text-sm" value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">Choose a studio</option>
          {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <Messages error={avail.error} />
      {loc && avail.data?.length === 0 && <p className="text-sm text-muted-foreground">This studio has no booths yet.</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {avail.data?.map((a) => {
          const free = a.booth_status === "available" && !clash(a);
          return (
            <li key={a.booth_id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span><span className="font-medium">{a.booth}</span> · {a.booth_status !== "available" ? a.booth_status : free ? "free at this time" : "busy at this time"}</span>
              <Button size="sm" disabled={!free || busy} onClick={() => onHold(a.booth_id)}>Hold</Button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Busy means another booking overlaps this time including setup and teardown. The server re-checks when you hold, so two brands can’t take the same slot.</p>
    </div>
  );
}
