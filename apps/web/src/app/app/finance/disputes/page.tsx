"use client";
// Dispute queue: Creator Hub finance sees disputes on its sessions; the platform admin (with MFA) sees all and decides.
import Link from "next/link";
import { useState } from "react";
import { Empty, Messages, PageHeader, Status, selectClass, when } from "@/components/bits";
import { useSession } from "@/components/shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, usd } from "@/lib/api";
import type { Dispute } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

export default function Disputes() {
  const { current } = useSession();
  const org = current?.org_id;
  const [status, setStatus] = useState("open");
  const list = useLoad(() => api<Dispute[]>(`disputes${status ? `?status=${status}` : ""}`, { org }), `${org}:${status}`);
  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="Disputes" description="Brands and sellers open disputes; a platform admin decides. Only the disputed part of a seller’s pay is held." />
      <label className="grid w-48 gap-1 text-sm">Status
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open</option><option value="decided">Decided</option><option value="">All</option></select>
      </label>
      <Messages error={list.error} />
      {list.data?.length === 0 && <Empty>No disputes.</Empty>}
      {!!list.data?.length && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Opened</TableHead><TableHead>Type</TableHead><TableHead>Claim</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{when(d.created_at)}</TableCell>
                  <TableCell>{d.type.replace("_", " ")}</TableCell>
                  <TableCell><Link className="hover:underline" href={`/app/disputes/${d.id}`}>{d.claim}</Link></TableCell>
                  <TableCell className="text-right tabular-nums">{usd(d.amount_cents)}</TableCell>
                  <TableCell><Status value={d.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
