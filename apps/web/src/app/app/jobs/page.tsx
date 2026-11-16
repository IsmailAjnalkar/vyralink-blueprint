"use client";
import { useAsk } from "@/components/ask";
// Seller job marketplace and invitations (blueprint C09–C12): browse, apply, accept, decline, counter, then sign.
import Link from "next/link";
import { useState } from "react";
import { Empty, Messages, PageHeader, Status, when } from "@/components/bits";
import { Thread } from "@/components/thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, pct, toUnits, usd } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Job = {
  id: string; name: string; brand: string; starts_at: string; ends_at: string; base_rate_cents: number; commission_bps: number; bonus_cents: number; bonus_gmv_threshold_cents: number | null;
  required_courses: string[]; location: string | null; address: string | null; products: string[] | null; my_status: string | null; trained: boolean;
};
type Invitation = { id: string; campaign_id: string; campaign: string; kind: string; status: string; terms: { baseRateCents: number }; counter: { baseRateCents: number } | null; starts_at: string; expires_at: string };
type Contracted = { status: string; contract?: { id: string } };

export default function JobsPage() {
  const jobs = useLoad(() => api<Job[]>("jobs"), "jobs");
  const { one } = useAsk();
  const invites = useLoad(() => api<Invitation[]>("seller/invitations"), "invites");
  const act = useAction(() => Promise.all([jobs.reload(), invites.reload()]));
  const [contract, setContract] = useState<string | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const post = <T = unknown,>(path: string, body: unknown = {}) => () => api<T>(path, { body });
  const open = invites.data?.filter((i) => ["invited", "viewed", "countered", "applied"].includes(i.status)) ?? [];

  async function accept(i: Invitation) {
    const r = await act.run(post<Contracted>(`invitations/${i.id}/accept`), "Accepted. Sign the contract to lock in the booking.");
    if (r?.contract) setContract(r.contract.id);
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="LIVE jobs" description="Open sessions from verified brands at Creator Hub studios. Creator Hub pays you." />
      <Messages error={act.error ?? jobs.error ?? invites.error} notice={act.notice} />
      {contract && <p className="text-sm"><Link className="font-medium underline" href={`/app/contracts/${contract}`}>Review and sign the contract →</Link></p>}
      <Tabs defaultValue="invites">
        <TabsList>
          <TabsTrigger value="invites">Invitations & applications{open.length ? ` (${open.length})` : ""}</TabsTrigger>
          <TabsTrigger value="jobs">Browse jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="invites" className="grid gap-3">
          {invites.data?.length === 0 && <Empty>No invitations yet. Browse jobs and apply, or keep your profile up to date so brands find you.</Empty>}
          {invites.data?.map((i) => (
            <Card key={i.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">{i.campaign} <Status value={i.status} /> <Badge variant="outline">{i.kind}</Badge></CardTitle>
                <CardDescription>{when(i.starts_at)} · base rate {usd(i.terms.baseRateCents)}{i.counter && ` · your counter ${usd(i.counter.baseRateCents)}`}{["invited", "viewed"].includes(i.status) && ` · answer by ${when(i.expires_at)}`}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {i.kind === "invite" && ["invited", "viewed"].includes(i.status) && (
                  <>
                    <Button size="sm" disabled={act.busy} onClick={() => accept(i)}>Accept</Button>
                    <Button size="sm" variant="outline" disabled={act.busy} onClick={async () => {
                      const cents = toUnits((await one(`Counter-offer: ${i.campaign}`, "Your base rate (USD)", { inputMode: "decimal", confirmLabel: "Send counter-offer" })) ?? "");
                      if (cents && !Number.isNaN(cents)) act.run(post(`invitations/${i.id}/counter`, { baseRateCents: cents }), "Counter-offer sent.");
                    }}>Counter</Button>
                    <Button size="sm" variant="ghost" disabled={act.busy} onClick={async () => {
                      const reason = await one(`Decline ${i.campaign}`, "Why are you declining? (shared with the brand)", { multiline: true, confirmLabel: "Decline", destructive: true });
                      if (reason) act.run(post(`invitations/${i.id}/decline`, { reason }), "Declined.");
                    }}>Decline</Button>
                  </>
                )}
                {i.status === "accepted" && <span className="text-sm text-muted-foreground">Accepted. Check your notifications for the contract.</span>}
                <Button size="sm" variant="ghost" onClick={() => { setThread(thread === i.campaign_id ? null : i.campaign_id); if (i.status === "invited") api(`invitations/${i.id}/view`, { body: {} }).catch(() => {}); }} aria-expanded={thread === i.campaign_id}>Messages</Button>
              </CardContent>
              {thread === i.campaign_id && <CardContent><Thread campaignId={i.campaign_id} /></CardContent>}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="jobs" className="grid gap-3">
          {jobs.data?.length === 0 && <Empty>No open jobs right now.</Empty>}
          {jobs.data?.map((j) => (
            <Card key={j.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">{j.name} <span className="text-sm font-normal text-muted-foreground">by {j.brand}</span>{j.my_status && <Status value={j.my_status} />}</CardTitle>
                <CardDescription>{when(j.starts_at)} – {new Date(j.ends_at).toLocaleTimeString([], { timeStyle: "short" })}{j.location && ` · ${j.location}${j.address ? `, ${j.address}` : ""}`}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p>{usd(j.base_rate_cents)} base + {pct(j.commission_bps)} commission{j.bonus_cents ? ` + ${usd(j.bonus_cents)} bonus at ${usd(j.bonus_gmv_threshold_cents)} GMV` : ""}</p>
                {j.products && <p className="text-muted-foreground">Products: {j.products.join(", ")}</p>}
                {j.required_courses.length > 0 && <p>Training: {j.required_courses.join(", ")} {j.trained ? "✓ done" : <Link href="/app/academy" className="underline">(take it first)</Link>}</p>}
                {!j.my_status && <Button size="sm" className="w-fit" disabled={act.busy} onClick={() => act.run(post(`jobs/${j.id}/apply`, {}), `Applied to ${j.name}. The brand will review it.`)}>Apply</Button>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
