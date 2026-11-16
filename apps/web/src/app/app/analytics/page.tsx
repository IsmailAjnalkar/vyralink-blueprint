"use client";
// Brand analytics (blueprint B16) across campaigns. Same settlement figures as the campaign report and invoices.
import Link from "next/link";
import { Empty, Messages, PageHeader, Status } from "@/components/bits";
import { BarChart } from "@/components/bar-chart";
import { useSession } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, usd } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

type Row = { campaignId: string; name: string; status: string; sessions: number; liveMinutes: number; orders: number; gmvCents: number; netSalesCents: number; costCents: number; gmvPerHourCents: number | null; final: boolean; source: string };
type Stats = { totals: { campaigns: number; sessions: number; liveMinutes: number; orders: number; gmvCents: number; netSalesCents: number; costCents: number; gmvPerHourCents: number | null; gmvToCost: number | null }; campaigns: Row[]; definitions: Record<string, string> };

const hours = (m: number) => `${Math.floor(m / 60)} h ${m % 60} min`;

export default function BrandAnalytics() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const s = useLoad(() => api<Stats>("analytics/brand", { org }), org);
  const d = s.data;
  const withResults = d?.campaigns.filter((c) => c.sessions > 0).sort((a, b) => b.gmvCents - a.gmvCents) ?? [];

  return (
    <div className="grid max-w-6xl gap-6">
      <PageHeader title="Analytics" description="Results from completed LIVE sessions. GMV is your sales; cost is Creator Hub’s fees." />
      <Messages error={s.error} />
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[["GMV", usd(d.totals.gmvCents)], ["Net sales", usd(d.totals.netSalesCents)], ["Campaign cost", usd(d.totals.costCents)], ["GMV ÷ cost", d.totals.gmvToCost == null ? "—" : `${d.totals.gmvToCost}×`], ["GMV per LIVE hour", usd(d.totals.gmvPerHourCents)], ["LIVE sessions", String(d.totals.sessions)]].map(([k, v]) => (
              <Card key={k}><CardHeader><CardTitle className="text-xs font-medium text-muted-foreground">{k}</CardTitle></CardHeader><CardContent className="text-2xl font-bold tabular-nums">{v}</CardContent></Card>
            ))}
          </div>
          <Card>
            <CardContent className="pt-6">
              <BarChart title="GMV by campaign" valueLabel="GMV" bars={withResults.map((c) => ({ label: c.name, value: c.gmvCents, display: usd(c.gmvCents), detail: `${c.orders} orders · ${hours(c.liveMinutes)} LIVE` }))} />
            </CardContent>
          </Card>
          {d.campaigns.length === 0 ? <Empty>No campaigns yet.</Empty> : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Status</TableHead><TableHead className="text-right">GMV</TableHead><TableHead className="text-right">Net sales</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">GMV / h</TableHead><TableHead>Figures</TableHead></TableRow></TableHeader>
                <TableBody>
                  {d.campaigns.map((c) => (
                    <TableRow key={c.campaignId}>
                      <TableCell><Link className="font-medium hover:underline" href={c.sessions ? `/app/campaigns/${c.campaignId}/report` : `/app/campaigns/${c.campaignId}`}>{c.name}</Link></TableCell>
                      <TableCell><Status value={c.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">{usd(c.gmvCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{usd(c.netSalesCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{usd(c.costCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{usd(c.gmvPerHourCents)}</TableCell>
                      <TableCell>{c.sessions ? <Badge variant={c.source.startsWith("Sandbox") ? "destructive" : "outline"}>{c.final ? "Final" : "Provisional"} · {c.source}</Badge> : <span className="text-xs text-muted-foreground">{c.source}</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Card>
            <CardHeader><CardTitle>Definitions</CardTitle><CardDescription>Conversion and viewer numbers need a TikTok data integration (not available yet).</CardDescription></CardHeader>
            <CardContent><dl className="grid gap-2 text-sm">{Object.entries(d.definitions).map(([k, v]) => <div key={k}><dt className="font-medium">{k === "gmv" ? "GMV" : "Cost"}</dt><dd className="text-muted-foreground">{v}</dd></div>)}</dl></CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
