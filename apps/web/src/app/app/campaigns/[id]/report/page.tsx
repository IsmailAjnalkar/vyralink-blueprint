"use client";
// Brand campaign report (blueprint B16): results with sources, campaign cost, incidents, invoices.
import Link from "next/link";
import { useParams } from "next/navigation";
import { Messages, PageHeader, Status } from "@/components/bits";
import { OpenDispute } from "@/components/open-dispute";
import { useSession } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, usd } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

type Report = {
  campaign: string; status: string; final?: boolean; note?: string;
  results: { orders: number; gmvCents: number; refundsCents: number; netSalesCents: number; liveMinutes: number; gmvPerHourCents: number | null; averageOrderCents: number | null; conversionRate: number | null } | null;
  sources?: Record<string, string>; campaignCostCents?: number; gmvToCostRatio?: number | null; definitions?: Record<string, string>;
  incidents?: { category: string; severity: string; description: string; minutes_lost: number | null; status: string }[];
  invoices?: { number: string; kind: string; amount_cents: number; status: string }[];
};
type Detail = { bookings: { id: string; status: string }[] };

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const r = useLoad(() => api<Report>(`campaigns/${id}/report`, { org }), `${org}:${id}`);
  const c = useLoad(() => api<Detail>(`campaigns/${id}`, { org }), `${org}:${id}:c`);
  const d = r.data;
  const booking = c.data?.bookings.find((b) => b.status === "completed");
  const res = d?.results;

  return (
    <div className="grid max-w-4xl gap-6">
      <Link href={`/app/campaigns/${id}`} className="text-sm underline">← Campaign</Link>
      <PageHeader title={d ? `${d.campaign}: report` : "Report"} description={d && <><Status value={d.status} /> {d.final ? <Badge>Final</Badge> : <Badge variant="outline">Provisional</Badge>}</>} />
      <Messages error={r.error} />
      {d && !res && <p className="text-sm text-muted-foreground">{d.note}</p>}
      {res && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[["GMV", usd(res.gmvCents), d.sources?.orders], ["Net sales", usd(res.netSalesCents), d.sources?.orders], ["Orders", String(res.orders), d.sources?.orders], ["GMV / LIVE hour", usd(res.gmvPerHourCents), d.sources?.liveHours],
              ["Average order", usd(res.averageOrderCents), d.sources?.orders], ["LIVE time", `${Math.floor(res.liveMinutes / 60)} h ${res.liveMinutes % 60} min`, d.sources?.liveHours], ["Conversion", res.conversionRate == null ? "—" : `${res.conversionRate}%`, d.sources?.conversionRate], ["Campaign cost", usd(d.campaignCostCents), "Invoices"]].map(([k, v, s]) => (
              <Card key={k}><CardHeader><CardTitle className="text-xs font-medium text-muted-foreground">{k}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold tabular-nums">{v}</p><p className="text-[11px] text-muted-foreground">{s}</p></CardContent></Card>
            ))}
          </div>
          {d.gmvToCostRatio != null && <p className="text-sm">GMV was <strong>{d.gmvToCostRatio}×</strong> the campaign cost.</p>}
          <Card>
            <CardHeader><CardTitle>Definitions</CardTitle></CardHeader>
            <CardContent><dl className="grid gap-2 text-sm">{Object.entries(d.definitions ?? {}).map(([k, v]) => <div key={k}><dt className="font-medium">{k === "gmv" ? "GMV" : "Campaign cost"}</dt><dd className="text-muted-foreground">{v}</dd></div>)}</dl></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Incidents</CardTitle><CardDescription>{d.incidents?.length ? `${d.incidents.length} recorded` : "None recorded"}</CardDescription></CardHeader>
            {!!d.incidents?.length && <CardContent><ul className="grid gap-1 text-sm">{d.incidents.map((i, n) => <li key={n}><Badge variant={i.severity === "high" ? "destructive" : "outline"}>{i.severity}</Badge> {i.category}: {i.description}{i.minutes_lost ? ` (${i.minutes_lost} min lost)` : ""}</li>)}</ul></CardContent>}
          </Card>
          <Card>
            <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
            <CardContent><ul className="grid gap-1 text-sm">{d.invoices?.map((i) => <li key={i.number} className="flex justify-between"><span className="font-mono">{i.number} · {i.kind.replace("_", " ")}</span><span>{usd(i.amount_cents)} <Status value={i.status} /></span></li>)}</ul></CardContent>
          </Card>
          {booking && <OpenDispute org={org} target={{ bookingId: booking.id }} types={["deliverables", "attribution"]} label="Dispute this session" />}
        </>
      )}
    </div>
  );
}
