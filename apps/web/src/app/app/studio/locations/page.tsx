"use client";
// Creator Hub locations, booths and equipment (blueprint O01–O05). Location Managers edit; producers manage equipment.
import { useState } from "react";
import { Empty, Messages, PageHeader, Status, selectClass } from "@/components/bits";
import { Field, TextField } from "@/components/form";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import type { Booth, Equipment, Location } from "@/lib/types";
import { useAction, useLoad } from "@/lib/use-load";

const SETTINGS: [key: keyof Location, body: string, label: string][] = [
  ["setup_min", "setupMin", "Setup before each LIVE (min)"], ["teardown_min", "teardownMin", "Teardown after (min)"], ["hold_hours", "holdHours", "Brand hold lasts (hours)"],
  ["sample_cutoff_hours", "sampleCutoffHours", "Samples due before LIVE (hours)"], ["checkin_open_min", "checkinOpenMin", "Check-in opens before arrival (min)"], ["no_show_min", "noShowMin", "No-show after arrival (min)"],
];

export default function LocationsPage() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const isManager = current?.role === "location_manager";
  const locs = useLoad(() => api<Location[]>("locations", { org }).then((ls) => ls.filter((l) => l.org_id === org)), org);
  const act = useAction(locs.reload);
  const [sel, setSel] = useState<string | null>(null);
  const loc = locs.data?.find((l) => l.id === sel) ?? locs.data?.[0];

  async function create(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const l = await act.run(() => api<Location>("locations", { org, body: { name: String(f.get("name")).trim(), address: String(f.get("address")).trim() || undefined, status: String(f.get("status")) } }), "Location added.");
    if (l) { setSel(l.id); form.reset(); }
  }

  if (current?.kind !== "operator") return <PageHeader title="Locations" description="Creator Hub staff only." />;
  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="Locations" description="Studios, booths and equipment. Brands only see whether a booth is free or busy." />
      <Messages error={act.error ?? locs.error} notice={act.notice} />
      {locs.data?.length === 0 && <Empty>No locations yet.</Empty>}
      {!!locs.data?.length && (
        <Field id="loc" label="Location">
          <select id="loc" className={`${selectClass} max-w-sm`} value={loc?.id} onChange={(e) => setSel(e.target.value)}>
            {locs.data.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      )}
      {loc && <LocationDetail key={loc.id} loc={loc} org={org} isManager={isManager} onSaved={locs.reload} />}
      {isManager && (
        <Card>
          <CardHeader><CardTitle>Add a location</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
              <TextField id="new-name" name="name" label="Name" placeholder="Creator Hub Virginia" required />
              <TextField id="new-address" name="address" label="Address" placeholder="Richmond, VA" />
              <Field id="new-status" label="Status">
                <select id="new-status" name="status" className={selectClass} defaultValue="open"><option value="opening">Opening soon</option><option value="open">Open</option><option value="closed">Closed</option></select>
              </Field>
              <Button type="submit" disabled={act.busy}>Add location</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LocationDetail({ loc, org, isManager, onSaved }: { loc: Location; org: string; isManager: boolean; onSaved: () => unknown }) {
  const booths = useLoad(() => api<Booth[]>(`locations/${loc.id}/booths`, { org }), loc.id);
  const equip = useLoad(() => api<Equipment[]>(`locations/${loc.id}/equipment`, { org }), loc.id);
  const act = useAction(() => Promise.all([booths.reload(), equip.reload(), onSaved()]));
  const boothName = (id: string | null) => booths.data?.find((b) => b.id === id)?.name ?? "Floating";

  async function saveSettings(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { status: String(f.get("status")), address: String(f.get("address")).trim() || undefined };
    for (const [, k] of SETTINGS) {
      const n = Number(f.get(k));
      if (!Number.isInteger(n) || n < 0) return act.run(() => Promise.reject(new ApiError(400, "Settings are whole minutes or hours, 0 or more.")));
      body[k] = n;
    }
    await act.run(() => api(`locations/${loc.id}`, { method: "PATCH", org, body }), "Settings saved. They apply to new holds and bookings.");
  }
  async function addBooth(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const cats = String(f.get("categories")).split(",").map((s) => s.trim()).filter(Boolean);
    if (await act.run(() => api(`locations/${loc.id}/booths`, { org, body: { name: String(f.get("name")).trim(), type: String(f.get("type")).trim(), categories: cats } }), "Booth added.")) form.reset();
  }
  async function addEquipment(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const boothId = String(f.get("booth")) || undefined;
    if (await act.run(() => api(`locations/${loc.id}/equipment`, { org, body: { code: String(f.get("code")).trim(), type: String(f.get("type")).trim(), boothId } }), "Equipment added.")) form.reset();
  }

  return (
    <div className="grid gap-6">
      <Messages error={act.error ?? booths.error} notice={act.notice} />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">{loc.name} <Status value={loc.status} /></CardTitle><CardDescription>{loc.address || "No address"} · {loc.timezone}</CardDescription></CardHeader>
        {isManager && (
          <CardContent>
            <form onSubmit={saveSettings} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {SETTINGS.map(([col, k, label]) => <TextField key={k} id={k} name={k} label={label} type="number" min={0} defaultValue={String(loc[col])} required />)}
                <TextField id="address" name="address" label="Address" defaultValue={loc.address} />
                <Field id="status" label="Status">
                  <select id="status" name="status" className={selectClass} defaultValue={loc.status}><option value="opening">Opening soon</option><option value="open">Open</option><option value="closed">Closed</option></select>
                </Field>
              </div>
              <Button type="submit" disabled={act.busy} className="w-fit">Save settings</Button>
            </form>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle>Booths</CardTitle><CardDescription>Taking a booth out of service lists the upcoming bookings to move.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          {booths.data?.length === 0 && <Empty>No booths yet.</Empty>}
          {!!booths.data?.length && (
            <Table>
              <TableHeader><TableRow><TableHead>Booth</TableHead><TableHead>Type</TableHead><TableHead>Categories</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {booths.data.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.type}</TableCell>
                    <TableCell>{b.categories.join(", ") || "—"}</TableCell>
                    <TableCell>
                      {isManager ? (
                        <select aria-label={`Status of ${b.name}`} className="h-8 rounded-md border bg-background px-2 text-sm" value={b.status}
                          onChange={(e) => act.run(() => api<{ bookingsToReassign: string[] }>(`booths/${b.id}`, { method: "PATCH", org, body: { status: e.target.value } }),
                            (r) => (r.bookingsToReassign.length ? `${b.name} is ${e.target.value}. ${r.bookingsToReassign.length} upcoming booking(s) need another booth: open them under Bookings and use “Move to booth”.` : `${b.name} is ${e.target.value}.`))}>
                          <option value="available">Available</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option>
                        </select>
                      ) : <Status value={b.status} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {isManager && (
            <form onSubmit={addBooth} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <TextField id="booth-name" name="name" label="Booth name" placeholder="Beauty Booth 01" required />
              <TextField id="booth-type" name="type" label="Type" placeholder="beauty" required />
              <TextField id="booth-cats" name="categories" label="Categories" placeholder="beauty, skincare" />
              <Button type="submit" disabled={act.busy}>Add booth</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Equipment</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Messages error={equip.error} />
          {equip.data?.length === 0 && <Empty>No equipment recorded.</Empty>}
          {!!equip.data?.length && (
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Booth</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {equip.data.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.code}</TableCell>
                    <TableCell>{q.type}</TableCell>
                    <TableCell>{boothName(q.booth_id)}</TableCell>
                    <TableCell>
                      <select aria-label={`Status of ${q.code}`} className="h-8 rounded-md border bg-background px-2 text-sm" value={q.status}
                        onChange={(e) => act.run(() => api(`equipment/${q.id}`, { method: "PATCH", org, body: { status: e.target.value } }), `${q.code}: ${e.target.value.replace("_", " ")}.`)}>
                        <option value="ok">OK</option><option value="needs_check">Needs check</option><option value="repair">In repair</option><option value="retired">Retired</option>
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <form onSubmit={addEquipment} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <TextField id="eq-code" name="code" label="Asset code" placeholder="CAM-01" required />
            <TextField id="eq-type" name="type" label="Type" placeholder="camera" required />
            <Field id="eq-booth" label="Booth">
              <select id="eq-booth" name="booth" className={selectClass}><option value="">Floating</option>{booths.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </Field>
            <Button type="submit" disabled={act.busy}>Add equipment</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
