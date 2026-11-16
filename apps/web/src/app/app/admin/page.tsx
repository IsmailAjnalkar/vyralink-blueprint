"use client";
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

type Verification = { id: string; org_name: string; version: number; status: string; details: Record<string, string>; documents: { type: string; fileName: string }[]; created_at: string };
type Product = { id: string; name: string; brand: string; sku: string; price_cents: number; category: string; description: string; selling_points: string[]; restricted_claims: string[] };
type User = { id: string; name: string; email: string; locked: boolean; memberships: unknown[] };

export default function AdminPage() {
  const { me } = useSession();
  const ver = useLoad(() => api<Verification[]>("admin/verifications?status=submitted"), "ver");
  const prods = useLoad(() => api<Product[]>("admin/products"), "prods");
  const users = useLoad(() => api<User[]>("admin/users"), "users");
  const act = useAction(() => Promise.all([ver.reload(), prods.reload()]));
  const [q, setQ] = useState("");
  const canDecide = me.user.is_super_admin;
  const post = (path: string, body: unknown) => () => api(path, { body });
  const decide = (path: string, decision: string, okMsg: string) => {
    const note = decision === "approve" ? undefined : prompt("Explain what needs to change (shared with the brand)") ?? "";
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
                  <dt className="text-muted-foreground">documents</dt><dd>{v.documents.map((d) => `${d.type}: ${d.fileName}`).join(" · ")}</dd>
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
                <CardTitle>{p.name}</CardTitle>
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
      </Tabs>
    </div>
  );
}
