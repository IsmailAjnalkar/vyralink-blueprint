"use client";
// Studio "today" board (blueprint O06): today's sessions and what needs attention.
import Link from "next/link";
import { useState } from "react";
import { Empty, Messages, PageHeader, Status, selectClass, when } from "@/components/bits";
import { useSession } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Location } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

type Today = { location: string; open_incidents: number; shipments_expected: number; producer_gaps: number; sessions: { id: string; status: string; starts_at: string; ends_at: string; booth: string; campaign: string; needs_producer: boolean }[] };

export default function StudioToday() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const locs = useLoad(() => api<Location[]>("locations", { org }).then((ls) => ls.filter((l) => l.org_id === org)), org);
  const [sel, setSel] = useState("");
  const locId = sel || locs.data?.[0]?.id || "";
  const today = useLoad(() => (locId ? api<Today>(`locations/${locId}/today`, { org }) : Promise.resolve(null)), `${org}:${locId}`);
  const t = today.data;

  if (current?.kind !== "operator") return <PageHeader title="Studio" description="Creator Hub staff only." />;
  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title={t ? `Today at ${t.location}` : "Studio today"} actions={<><Button asChild variant="outline"><Link href="/app/studio/bookings">All bookings</Link></Button><Button variant="outline" onClick={() => today.reload()}>Refresh</Button></>} />
      <Messages error={locs.error ?? today.error} />
      {locs.data?.length === 0 && <Empty>No locations yet. <Link className="underline" href="/app/studio/locations">Add one</Link>.</Empty>}
      {(locs.data?.length ?? 0) > 1 && (
        <select aria-label="Location" className={`${selectClass} max-w-sm`} value={locId} onChange={(e) => setSel(e.target.value)}>
          {locs.data!.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}
      {t && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Open incidents", t.open_incidents], ["Sample shipments expected", t.shipments_expected], ["Sessions in 72 h without a producer", t.producer_gaps]].map(([k, v]) => (
              <Card key={k as string}><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{k}</CardTitle></CardHeader><CardContent className={`text-2xl font-bold ${v ? "text-destructive" : ""}`}>{v}</CardContent></Card>
            ))}
          </div>
          {t.sessions.length === 0 ? <Empty>No sessions today.</Empty> : (
            <ul className="grid gap-2">
              {t.sessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/app/studio/bookings/${s.id}`} className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm hover:bg-accent/50">
                    <span className="font-mono">{new Date(s.starts_at).toLocaleTimeString([], { timeStyle: "short" })}</span>
                    <span className="font-medium">{s.campaign}</span>
                    <span className="text-muted-foreground">{s.booth}</span>
                    <Status value={s.status} />
                    {s.needs_producer && <Badge variant="destructive">needs producer</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">ends {when(s.ends_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
