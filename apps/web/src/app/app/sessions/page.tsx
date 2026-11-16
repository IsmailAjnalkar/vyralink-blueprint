"use client";
// Seller's booked sessions (blueprint C13–C16): where and when to arrive, the check-in code, the briefing.
import { Empty, Messages, PageHeader, Status, when } from "@/components/bits";
import { OpenDispute } from "@/components/open-dispute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Session = {
  id: string; status: string; starts_at: string; ends_at: string; arrival_at: string; checkin_code: string; booth: string; location: string; address: string;
  campaign: string; brand: string; producer: string | null; briefing: string | null;
  products: { name: string; sellingPoints: string[]; restrictedClaims: string[] }[];
};

export default function SessionsPage() {
  const list = useLoad(() => api<Session[]>("seller/bookings"), "sessions");
  const act = useAction(list.reload);
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="My sessions" description="Show the check-in code at the front desk. Arrive by the time shown: late arrivals can be recorded as a no-show." />
      <Messages error={act.error ?? list.error} notice={act.notice} />
      {list.data?.length === 0 && <Empty>No booked sessions yet. They appear here after both sides sign and the studio confirms.</Empty>}
      {list.data?.map((s) => {
        const upcoming = ["hold", "confirmed", "checked_in"].includes(s.status);
        return (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">{s.campaign} <Status value={s.status} /></CardTitle>
              <CardDescription>{s.brand} · {s.location}, {s.booth}{s.address && ` · ${s.address}`}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <dl className="grid gap-1 sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Arrive by</dt><dd className="font-semibold">{when(s.arrival_at)}</dd></div>
                <div><dt className="text-muted-foreground">LIVE</dt><dd>{when(s.starts_at)} – {new Date(s.ends_at).toLocaleTimeString([], { timeStyle: "short" })}</dd></div>
                <div><dt className="text-muted-foreground">Producer</dt><dd>{s.producer ?? "Not assigned yet"}</dd></div>
              </dl>
              {upcoming && s.status !== "hold" && (
                <p className="rounded-md border-2 border-dashed p-3 text-center">
                  <span className="block text-xs text-muted-foreground">Check-in code</span>
                  <span className="font-mono text-2xl font-bold tracking-widest">{s.checkin_code}</span>
                </p>
              )}
              {upcoming && (
                <section aria-label={`Briefing for ${s.campaign}`} className="grid gap-2 rounded-md bg-muted/40 p-3">
                  <h3 className="font-semibold">Briefing</h3>
                  {s.products.map((p) => (
                    <div key={p.name}>
                      <p className="font-medium">{p.name}</p>
                      <p>Say: {p.sellingPoints.join("; ") || "—"}</p>
                      <p className="text-destructive">Never say: {p.restrictedClaims.join("; ") || "—"}</p>
                    </div>
                  ))}
                </section>
              )}
              {upcoming && s.status !== "hold" && (s.briefing === "pass"
                ? <p>✓ Briefing read</p>
                : <Button size="sm" className="w-fit" disabled={act.busy || !s.briefing} onClick={() => act.run(() => api(`bookings/${s.id}/briefing/acknowledge`, { body: {} }), "Thanks. The producer can see you read the briefing.")}>I’ve read the briefing</Button>)}
              {s.status === "completed" && <OpenDispute target={{ bookingId: s.id }} types={["commission", "attribution"]} label="Dispute my pay for this session" />}
              <p className="text-xs text-muted-foreground">The LIVE runs in the TikTok app on the studio device. The producer tells you when to go LIVE and when to end.</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
