"use client";
import Link from "next/link";
import { Empty, Messages, PageHeader, Status, when } from "@/components/bits";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, usd } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

export default function CampaignsPage() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const list = useLoad(() => api<Campaign[]>("campaigns", { org }), org);
  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="Campaigns" description="A campaign is one LIVE session: products, studio time, a seller and the money terms."
        actions={<Button asChild><Link href="/app/campaigns/new">New campaign</Link></Button>} />
      <Messages error={list.error} />
      {list.data?.length === 0 && <Empty>No campaigns yet.</Empty>}
      {!!list.data?.length && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>LIVE starts</TableHead><TableHead>Budget cap</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><Link href={`/app/campaigns/${c.id}`} className="font-medium hover:underline">{c.name}</Link></TableCell>
                  <TableCell>{when(c.starts_at)}</TableCell>
                  <TableCell>{usd(c.budget_cap_cents)}</TableCell>
                  <TableCell><Status value={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
