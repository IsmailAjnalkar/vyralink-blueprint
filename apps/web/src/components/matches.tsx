"use client";
// Recommended sellers for a campaign: published rules, a reason for every point, invite from the list.
import { Messages, Status } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Match = { sellerId: string; name: string; score: number; ready: boolean; invitation: string | null; parts: { rule: string; points: number; reason: string }[] };
type Matches = { weights: Record<string, number>; method: string; ranked: Match[]; excluded: { reason: string; count: number }[] };

export function Recommendations({ campaignId, org, canInvite, onInvited }: { campaignId: string; org: string; canInvite: boolean; onInvited: () => unknown }) {
  const m = useLoad(() => api<Matches>(`campaigns/${campaignId}/matches`, { org }), `${org}:${campaignId}`);
  const act = useAction(() => Promise.all([m.reload(), onInvited()]));
  const d = m.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended sellers</CardTitle>
        <CardDescription>{d?.method} Weights: {d && Object.entries(d.weights).map(([k, v]) => `${k} ${v}`).join(" · ")}.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Messages error={act.error ?? m.error} notice={act.notice} />
        {d?.ranked.length === 0 && <p className="text-sm text-muted-foreground">No sellers match yet.</p>}
        <ol className="grid gap-2">
          {d?.ranked.slice(0, 5).map((r, i) => (
            <li key={r.sellerId} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                <span className="font-medium">{r.name}</span>
                <Badge variant="outline">{r.score} / 100</Badge>
                {!r.ready && <Badge variant="destructive">training missing</Badge>}
                {r.invitation && <Status value={r.invitation} />}
                {canInvite && !r.invitation && (
                  <Button size="sm" className="ml-auto" disabled={act.busy} onClick={() => act.run(() => api(`campaigns/${campaignId}/invitations`, { org, body: { sellerId: r.sellerId } }), `Invited ${r.name}.`)}>Invite</Button>
                )}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs underline">Why this score</summary>
                <ul className="mt-1 grid gap-0.5 text-xs">
                  {r.parts.map((p) => <li key={p.rule}><span className="inline-block w-20 font-medium">{p.rule}</span> <span className="tabular-nums">+{p.points}</span> · {p.reason}</li>)}
                </ul>
              </details>
            </li>
          ))}
        </ol>
        {!!d?.excluded.length && <p className="text-xs text-muted-foreground">Not shown: {d.excluded.map((e) => `${e.count} (${e.reason.toLowerCase()})`).join(", ")}.</p>}
      </CardContent>
    </Card>
  );
}
