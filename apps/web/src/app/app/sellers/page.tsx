"use client";
// Creator discovery (blueprint B09–B11): filter on verified results, compare up to 3, invite to a campaign.
// Every stat shown comes from completed Vyralink sessions; follower counts are labelled self-reported.
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Empty, Messages, PageHeader, selectClass } from "@/components/bits";
import { Field, TextField } from "@/components/form";
import { useSession } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, pct, toUnits, usd } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import { useAction, useLoad } from "@/lib/use-load";

type Seller = {
  user_id: string; display_name: string; bio: string | null; city: string | null; categories: string[]; languages: string[]; rate_cents: number | null; commission_bps: number | null;
  followers_self_reported: string | null; verified_sessions: number; verified_minutes: number; verified_gmv_cents: number; verified_gmv_per_hour_cents: number | null; reliability_pct: number | null; certificates: string[];
};

export default function SellersPage() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const [filters, setFilters] = useState({ category: "", language: "", minGmv: "", verifiedOnly: false });
  const [campaignId, setCampaignId] = useState(useSearchParams().get("campaign") ?? "");
  const [compare, setCompare] = useState<string[]>([]);
  const qs = new URLSearchParams({
    ...(filters.category && { category: filters.category }), ...(filters.language && { language: filters.language }),
    ...(toUnits(filters.minGmv) ? { minGmvPerHourCents: String(toUnits(filters.minGmv)) } : {}), ...(filters.verifiedOnly && { verifiedOnly: "true" }),
  }).toString();
  const sellers = useLoad(() => api<Seller[]>(`sellers?${qs}`, { org }), `${org}?${qs}`);
  const campaigns = useLoad(() => api<Campaign[]>("campaigns", { org }).then((cs) => cs.filter((c) => ["published", "recruiting"].includes(c.status))), org);
  const act = useAction();
  const chosen = campaigns.data?.find((c) => c.id === campaignId);
  const toggle = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 3 ? [...c, id] : c));
  const compared = sellers.data?.filter((s) => compare.includes(s.user_id)) ?? [];

  function invite(s: Seller) {
    if (!chosen) return;
    act.run(() => api(`campaigns/${chosen.id}/invitations`, { org, body: { sellerId: s.user_id } }), `Invited ${s.display_name} to ${chosen.name} at ${usd(chosen.base_rate_cents)}. They’ll be notified and the invitation expires if unanswered.`);
  }

  return (
    <div className="grid max-w-6xl gap-6">
      <PageHeader title="Find LIVE Sellers" description="Results are ranked by verified GMV per hour from completed Vyralink sessions." />
      <Messages error={act.error ?? sellers.error ?? campaigns.error} notice={act.notice} />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-5">
          <TextField id="f-cat" label="Category" placeholder="Skincare" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
          <TextField id="f-lang" label="Language" placeholder="English" value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })} />
          <TextField id="f-gmv" label="Min GMV / hour (USD)" inputMode="decimal" value={filters.minGmv} onChange={(e) => setFilters({ ...filters, minGmv: e.target.value })} />
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={filters.verifiedOnly} onChange={(e) => setFilters({ ...filters, verifiedOnly: e.target.checked })} /> With completed sessions only</label>
          <Field id="f-campaign" label="Invite to campaign">
            <select id="f-campaign" className={selectClass} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Choose a published campaign</option>
              {campaigns.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </CardContent>
      </Card>

      {compared.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Compare</CardTitle><CardDescription>Verified results side by side.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Metric</TableHead>{compared.map((s) => <TableHead key={s.user_id}>{s.display_name}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {([["Verified sessions", (s) => s.verified_sessions], ["GMV / hour", (s) => usd(s.verified_gmv_per_hour_cents)], ["Total verified GMV", (s) => usd(s.verified_gmv_cents)], ["Reliability", (s) => (s.reliability_pct == null ? "—" : `${s.reliability_pct}%`)],
                  ["Rate", (s) => usd(s.rate_cents)], ["Commission", (s) => pct(s.commission_bps)], ["Certificates", (s) => s.certificates.length], ["Followers (self-reported)", (s) => s.followers_self_reported ?? "—"]] as [string, (s: Seller) => React.ReactNode][]).map(([k, f]) => (
                  <TableRow key={k}><TableCell className="text-muted-foreground">{k}</TableCell>{compared.map((s) => <TableCell key={s.user_id}>{f(s)}</TableCell>)}</TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {sellers.data?.length === 0 && <Empty>No sellers match these filters.</Empty>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sellers.data?.map((s) => (
          <li key={s.user_id}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{s.display_name}</CardTitle>
                <CardDescription>{[s.city, s.categories.join(", "), s.languages.join(", ")].filter(Boolean).join(" · ") || "Profile in progress"}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {s.bio && <p className="line-clamp-3">{s.bio}</p>}
                <dl className="grid grid-cols-2 gap-1">
                  <dt className="text-muted-foreground">GMV / hour</dt><dd className="font-medium">{s.verified_sessions ? usd(s.verified_gmv_per_hour_cents) : "New seller"}</dd>
                  <dt className="text-muted-foreground">Sessions</dt><dd>{s.verified_sessions}</dd>
                  <dt className="text-muted-foreground">Reliability</dt><dd>{s.reliability_pct == null ? "—" : `${s.reliability_pct}%`}</dd>
                  <dt className="text-muted-foreground">Rate</dt><dd>{usd(s.rate_cents)}</dd>
                </dl>
                <div className="flex flex-wrap gap-1">{s.certificates.map((c) => <Badge key={c} variant="outline">{c.replace(/_/g, " ")}</Badge>)}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={compare.includes(s.user_id)} onChange={() => toggle(s.user_id)} disabled={!compare.includes(s.user_id) && compare.length >= 3} /> Compare</label>
                  <Button size="sm" className="ml-auto" disabled={!chosen || act.busy} onClick={() => invite(s)} title={chosen ? undefined : "Choose a published campaign first"}>Invite</Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
