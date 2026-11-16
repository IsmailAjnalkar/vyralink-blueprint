"use client";
import { useAsk } from "@/components/ask";
// Platform review queue (blueprint A02–A04): brand verification, product compliance, seller provider checks (sandbox).
// Support admins can read; only a super admin (with two-step verification) decides.
import { Fragment, useState } from "react";
import { Empty, Messages, PageHeader, Status, when } from "@/components/bits";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, usd } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Verification = { id: string; org_name: string; version: number; status: string; details: Record<string, string>; documents: { type: string; fileName: string; fileId?: string }[]; created_at: string };
type Product = { id: string; image_file_id: string | null; name: string; brand: string; sku: string; price_cents: number; category: string; description: string; selling_points: string[]; restricted_claims: string[] };
type Org = { id: string; name: string; kind: string; status: string; members: number };
type User = { id: string; name: string; email: string; locked: boolean; mfa_on: boolean; is_super_admin: boolean; memberships: { role: string }[] };
type AuditRow = { id: string; at: string; action: string; actor_name: string | null; actor_email: string | null; target_type: string | null; target_id: string | null; detail: Record<string, unknown>; ip: string | null };

export default function AdminPage() {
  const { me } = useSession();
  const { one, confirm } = useAsk();
  const ver = useLoad(() => api<Verification[]>("admin/verifications?status=submitted"), "ver");
  const prods = useLoad(() => api<Product[]>("admin/products"), "prods");
  const users = useLoad(() => api<User[]>("admin/users"), "users");
  const orgs = useLoad(() => api<Org[]>("admin/orgs"), "orgs");
  const settings = useLoad(() => api<Record<string, unknown>>("admin/settings"), "settings");
  const integrations = useLoad(() => api<{ name: string; provider: string; status: string; detail: string }[]>("integrations"), "integrations");
  const [auditFilter, setAuditFilter] = useState("");
  const auditLog = useLoad(() => api<AuditRow[]>(`admin/audit?limit=200${auditFilter ? `&action=${encodeURIComponent(auditFilter)}` : ""}`), `audit:${auditFilter}`);
  const act = useAction(() => Promise.all([ver.reload(), prods.reload(), users.reload(), orgs.reload(), settings.reload(), auditLog.reload()]));
  const [q, setQ] = useState("");
  const [who, setWho] = useState("");
  const careful = async (title: string, description: string, label: string, path: string, body: unknown, okMsg: string) => {
    if (await confirm(title, description, label, true)) act.run(post(path, body), okMsg);
  };
  const canDecide = me.user.is_super_admin;
  const post = (path: string, body: unknown) => () => api(path, { body });
  const decide = async (path: string, decision: string, okMsg: string) => {
    const note = decision === "approve" ? undefined : (await one("Explain the decision", "What needs to change (shared with the brand)", { multiline: true })) ?? "";
    if (note === "") return;
    act.run(post(path, { decision, ...(note ? { note } : {}) }), okMsg);
  };

  if (!me.user.is_super_admin && !me.user.is_support_admin) return <PageHeader title="Admin" description="Platform staff only." />;
  return (
    <div className="grid max-w-6xl gap-6">
      <PageHeader title="Review queue" description={canDecide ? "Decisions are audited and the brand is notified." : "Read-only: support admins can’t decide."} />
      <Messages error={act.error ?? ver.error ?? prods.error} notice={act.notice} />
      <Tabs defaultValue="ver">
        <TabsList>
          <TabsTrigger value="ver">Brand verification ({ver.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="prod">Products ({prods.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="sellers">Seller checks</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="orgs">Organizations</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="ver" className="grid gap-3">
          {ver.data?.length === 0 && <Empty>Nothing waiting.</Empty>}
          {ver.data?.map((v) => (
            <Card key={v.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">{v.org_name} <Status value={v.status} /></CardTitle>
                <CardDescription>Version {v.version} · submitted {when(v.created_at)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <dl className="grid gap-x-4 sm:grid-cols-[max-content_1fr]">
                  {Object.entries(v.details).filter(([, val]) => val).map(([k, val]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{val}</dd></Fragment>)}
                  <dt className="text-muted-foreground">documents</dt><dd>{v.documents.map((d, i) => <span key={i}>{i ? " · " : ""}{d.type}: {d.fileId ? <a className="underline" href={`/api/files/${d.fileId}`}>{d.fileName}</a> : `${d.fileName} (not uploaded)`}</span>)}</dd>
                </dl>
                {canDecide && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={act.busy} onClick={() => decide(`admin/verifications/${v.id}/decision`, "approve", `${v.org_name} is verified.`)}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={act.busy} onClick={() => decide(`admin/verifications/${v.id}/decision`, "request_info", "Sent back for more information.")}>Request info</Button>
                    <Button size="sm" variant="destructive" disabled={act.busy} onClick={() => decide(`admin/verifications/${v.id}/decision`, "reject", "Rejected.")}>Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="prod" className="grid gap-3">
          {prods.data?.length === 0 && <Empty>Nothing waiting.</Empty>}
          {prods.data?.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">{p.image_file_id && <img src={`/api/files/${p.image_file_id}`} alt={`${p.name} product image`} className="size-12 rounded object-cover" />}{p.name}</CardTitle>
                <CardDescription>{p.brand} · {p.sku} · {p.category} · {usd(p.price_cents)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {p.description && <p>{p.description}</p>}
                <p><strong>Selling points:</strong> {p.selling_points.join("; ") || "—"}</p>
                <p><strong>Restricted claims:</strong> {p.restricted_claims.join("; ") || "—"}</p>
                {canDecide && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={act.busy} onClick={() => decide(`admin/products/${p.id}/decision`, "approve", `${p.name} approved.`)}>Approve</Button>
                    <Button size="sm" variant="destructive" disabled={act.busy} onClick={() => decide(`admin/products/${p.id}/decision`, "reject", `${p.name} sent back.`)}>Request changes</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="sellers" className="grid gap-3">
          <p className="text-sm text-muted-foreground">Sandbox: no identity or payout provider is connected, so this stands in for their webhooks. Applies to LIVE Seller accounts only.</p>
          <label className="grid max-w-sm gap-1 text-sm">Search people<input className="h-9 rounded-md border bg-background px-2" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {users.data?.filter((u) => u.memberships.length === 0 && `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{canDecide && <Button size="sm" variant="outline" disabled={act.busy} onClick={() => act.run(post(`admin/sellers/${u.id}/provider-status`, { identityVerified: true, payoutVerified: true, taxFormOnFile: true }), `${u.name}: identity, payout and tax form marked verified (sandbox).`)}>Mark verified (sandbox)</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="people" className="grid gap-3">
          <p className="text-sm text-muted-foreground">Locking signs the person out everywhere and blocks sign-in. Resetting two-step verification signs them out; they set it up again at next sign-in. Both are audited.</p>
          <label className="grid max-w-sm gap-1 text-sm">Search people<input className="h-9 rounded-md border bg-background px-2" value={who} onChange={(e) => setWho(e.target.value)} /></label>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Roles</TableHead><TableHead>Two-step</TableHead><TableHead>Account</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {users.data?.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(who.toLowerCase())).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="text-xs">{[u.is_super_admin && "super admin", ...u.memberships.map((m) => m.role.replaceAll("_", " "))].filter(Boolean).join(", ") || "LIVE seller"}</TableCell>
                    <TableCell>{u.mfa_on ? "On" : "Off"}</TableCell>
                    <TableCell><Status value={u.locked ? "locked" : "active"} /></TableCell>
                    <TableCell>
                      {canDecide && u.id !== me.user.id && (
                        <div className="flex gap-2">
                          {u.locked
                            ? <Button size="sm" variant="outline" disabled={act.busy} onClick={() => act.run(post(`admin/users/${u.id}/lock`, { locked: false }), `${u.name} can sign in again.`)}>Unlock</Button>
                            : <Button size="sm" variant="destructive" disabled={act.busy} onClick={() => careful(`Lock ${u.name}?`, "They are signed out everywhere and can’t sign in until unlocked.", "Lock account", `admin/users/${u.id}/lock`, { locked: true }, `${u.name} is locked and signed out.`)}>Lock</Button>}
                          {u.mfa_on && <Button size="sm" variant="outline" disabled={act.busy} onClick={() => careful(`Reset two-step verification for ${u.name}?`, "Only after confirming who they are (e.g. a lost phone). They are signed out and set it up again.", "Reset", `admin/users/${u.id}/reset-mfa`, {}, `${u.name}’s two-step verification was reset.`)}>Reset two-step</Button>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="grid gap-3">
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setAuditFilter(String(new FormData(e.currentTarget).get("action")).trim()); }}>
            <label className="grid gap-1 text-sm">Action starts with<input name="action" defaultValue={auditFilter} placeholder="e.g. user. or payout" className="h-9 w-56 rounded-md border bg-background px-2" /></label>
            <Button type="submit" size="sm" variant="outline">Filter</Button>
          </form>
          <p className="text-sm text-muted-foreground">Newest 200 entries. Audit entries can’t be edited or deleted.</p>
          {auditLog.error && <Messages error={auditLog.error} />}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Details</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
              <TableBody>
                {auditLog.data?.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{when(a.at)}</TableCell>
                    <TableCell>{a.actor_name ?? "System"}{a.actor_email && <span className="block text-xs text-muted-foreground">{a.actor_email}</span>}</TableCell>
                    <TableCell className="font-mono text-xs">{a.action}</TableCell>
                    <TableCell className="text-xs">{a.target_type}{a.target_id && <span className="block font-mono text-muted-foreground">{a.target_id.slice(0, 8)}</span>}</TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs" title={JSON.stringify(a.detail)}>{Object.keys(a.detail ?? {}).length ? JSON.stringify(a.detail) : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{a.ip ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {auditLog.data?.length === 0 && <Empty>No entries match.</Empty>}
        </TabsContent>

        <TabsContent value="orgs" className="grid gap-4">
          {canDecide && (
            <Card>
              <CardHeader><CardTitle>New Creator Hub organization</CardTitle><CardDescription>Brands sign up themselves. A studio operator is created here with its first Location Manager, who then invites the team.</CardDescription></CardHeader>
              <CardContent>
                <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const el = e.currentTarget;
                  const email = String(f.get("manager")).trim();
                  const ok = await act.run(async () => {
                    const o = await api<{ id: string; name: string }>("admin/orgs", { body: { kind: "operator", name: String(f.get("name")).trim() } });
                    await api(`admin/orgs/${o.id}/members`, { body: { email, role: "location_manager" } });
                    return o;
                  }, (o) => `${o.name} created with ${email} as Location Manager.`);
                  if (ok) el.reset();
                }}>
                  <label className="grid gap-1 text-sm">Organization name<input name="name" required className="h-9 rounded-md border bg-background px-2" placeholder="Creator Hub" /></label>
                  <label className="grid gap-1 text-sm">Location Manager’s account email<input name="manager" type="email" required className="h-9 rounded-md border bg-background px-2" /></label>
                  <Button type="submit" disabled={act.busy}>Create</Button>
                </form>
              </CardContent>
            </Card>
          )}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Organization</TableHead><TableHead>Kind</TableHead><TableHead>Status</TableHead><TableHead>Members</TableHead></TableRow></TableHeader>
              <TableBody>{orgs.data?.map((o) => <TableRow key={o.id}><TableCell className="font-medium">{o.name}</TableCell><TableCell>{o.kind === "operator" ? "Creator Hub" : "Brand"}</TableCell><TableCell><Status value={o.status} /></TableCell><TableCell>{o.members}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="grid gap-3">
          <p className="text-sm text-muted-foreground">Set by environment variables on the server (see docs/DEPLOYMENT.md). Production refuses to start on sandbox, dev or blocked providers.</p>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Integration</TableHead><TableHead>Provider</TableHead><TableHead>Status</TableHead><TableHead>What it means</TableHead></TableRow></TableHeader>
              <TableBody>{integrations.data?.map((i) => <TableRow key={i.name}><TableCell className="font-medium">{i.name}</TableCell><TableCell className="font-mono">{i.provider}</TableCell><TableCell><Status value={i.status === "blocked" ? "blocked" : i.status} /></TableCell><TableCell className="max-w-md text-xs">{i.detail}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="grid gap-3">
          <p className="text-sm text-muted-foreground">Platform rules. Money in cents, rates in basis points (100 = 1%). Changes are audited and apply to new records.</p>
          <ul className="grid gap-2">
            {Object.entries(settings.data ?? {}).map(([k, v]) => (
              <li key={k}>
                <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  const raw = String(new FormData(e.currentTarget).get("value")).trim();
                  const value = /^-?\d+$/.test(raw) ? Number(raw) : raw;
                  act.run(() => api(`admin/settings/${k}`, { method: "PUT", body: { value } }), `${k} = ${raw}`);
                }}>
                  <label className="grid gap-1 text-sm"><span className="font-mono">{k}</span><input name="value" aria-label={k} defaultValue={String(v)} disabled={!canDecide} className="h-9 w-48 rounded-md border bg-background px-2" /></label>
                  {canDecide && <Button type="submit" size="sm" variant="outline" disabled={act.busy}>Save</Button>}
                </form>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
