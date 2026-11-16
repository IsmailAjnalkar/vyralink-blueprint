"use client";
// Studio analytics (blueprint O21): booth use, session outcomes and incidents over a chosen window.
import { useState } from "react";
import { Empty, Messages, PageHeader, selectClass } from "@/components/bits";
import { BarChart } from "@/components/bar-chart";
import { useSession } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

type Stats = {
  days: number; noShowRatePct: number | null; bookingsByStatus: Record<string, number>; definitions: Record<string, string>;
  booths: { id: string; name: string; location: string; sessions: number; live_minutes: number; reserved_minutes: number }[];
  incidents: { category: string; severity: string; n: number; minutes_lost: number }[];
};
const hours = (m: number) => `${Math.floor(m / 60)} h ${m % 60} min`;

export default function StudioAnalytics() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const [days, setDays] = useState(30);
  const s = useLoad(() => api<Stats>(`analytics/studio?days=${days}`, { org }), `${org}:${days}`);
  const d = s.data;

  return (
    <div className="grid max-w-6xl gap-6">
      <PageHeader title="Studio analytics" description={d?.definitions.live}
        actions={<label className="flex items-center gap-2 text-sm">Window<select className={`${selectClass} w-32`} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map((n) => <option key={n} value={n}>Last {n} days</option>)}</select></label>} />
      <Messages error={s.error} />
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[["Completed sessions", String(d.bookingsByStatus.completed ?? 0)], ["No-shows", String(d.bookingsByStatus.no_show ?? 0)], ["No-show rate", d.noShowRatePct == null ? "—" : `${d.noShowRatePct}%`], ["Cancelled", String(d.bookingsByStatus.cancelled ?? 0)]].map(([k, v]) => (
              <Card key={k}><CardHeader><CardTitle className="text-xs font-medium text-muted-foreground">{k}</CardTitle></CardHeader><CardContent className="text-2xl font-bold tabular-nums">{v}</CardContent></Card>
            ))}
          </div>
          <Card>
            <CardContent className="pt-6">
              <BarChart title="Reserved time by booth" valueLabel="Reserved" bars={[...d.booths].sort((a, b) => b.reserved_minutes - a.reserved_minutes).map((b) => ({ label: b.name, value: b.reserved_minutes, display: hours(b.reserved_minutes), detail: `${b.sessions} completed · ${hours(b.live_minutes)} LIVE` }))} />
              <p className="mt-2 text-xs text-muted-foreground">{d.definitions.reserved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Incidents</CardTitle></CardHeader>
            <CardContent>
              {d.incidents.length === 0 ? <Empty>No incidents in this window.</Empty> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Severity</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Minutes lost</TableHead></TableRow></TableHeader>
                  <TableBody>{d.incidents.map((i) => <TableRow key={i.category + i.severity}><TableCell>{i.category}</TableCell><TableCell><Badge variant={i.severity === "high" ? "destructive" : "outline"}>{i.severity}</Badge></TableCell><TableCell className="text-right tabular-nums">{i.n}</TableCell><TableCell className="text-right tabular-nums">{i.minutes_lost}</TableCell></TableRow>)}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
