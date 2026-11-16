"use client";
import Link from "next/link";
import { useState } from "react";
import { Empty, Messages, PageHeader, Status, selectClass, when } from "@/components/bits";
import { useSession } from "@/components/shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Booking } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

const STATUSES = ["", "hold", "confirmed", "checked_in", "in_progress", "completed", "no_show", "cancelled", "expired"];

export default function StudioBookings() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(current?.role === "producer");
  const qs = new URLSearchParams({ ...(status && { status }), ...(mine && { mine: "true" }) }).toString();
  const list = useLoad(() => api<Booking[]>(`bookings?${qs}`, { org }), `${org}?${qs}`);

  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="Bookings" description="Holds become bookings when the contract is signed by both sides and you confirm." />
      <div className="flex flex-wrap items-end gap-4">
        <label className="grid gap-1 text-sm">Status
          <select className={`${selectClass} w-48`} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All"}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only sessions I produce</label>
      </div>
      <Messages error={list.error} />
      {list.data?.length === 0 && <Empty>No bookings match.</Empty>}
      {!!list.data?.length && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Starts</TableHead><TableHead>Campaign</TableHead><TableHead>Booth</TableHead><TableHead>Seller</TableHead><TableHead>Producer</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{when(b.starts_at)}</TableCell>
                  <TableCell><Link className="font-medium hover:underline" href={`/app/studio/bookings/${b.id}`}>{b.campaign}</Link></TableCell>
                  <TableCell>{b.booth}</TableCell>
                  <TableCell>{b.seller ?? "Not contracted yet"}</TableCell>
                  <TableCell>{b.producer_id ? "Assigned" : "—"}</TableCell>
                  <TableCell><Status value={b.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
