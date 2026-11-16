"use client";
import { useCallback, useEffect, useState } from "react";
import { roleLabel } from "@/components/shell";
import { FormError, TextField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";

type Member = { id: string; name: string; email: string; role: string };
type Invite = { email: string; role: string; expires_at: string };

export function Team({ orgId, roles, isManager, myId }: { orgId: string; roles: string[]; isManager: boolean; myId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([api<Member[]>("orgs/current/members", { org: orgId }), isManager ? api<Invite[]>("orgs/current/invitations", { org: orgId }) : Promise.resolve([])])
        .then(([m, i]) => { setMembers(m); setInvites(i); })
        .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn’t load the team.")),
    [orgId, isManager],
  );
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    setNotice(null);
    try { await fn(); setNotice(ok); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : "That didn’t work."); }
  };

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const form = e.currentTarget;
    await act(() => api("orgs/current/invitations", { org: orgId, body: { email, role: String(f.get("role")) } }), `Invitation sent to ${email}.`);
    form.reset();
  }

  return (
    <div className="grid gap-6">
      <FormError message={error} />
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>{isManager && <TableHead><span className="sr-only">Actions</span></TableHead>}</TableRow></TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    {isManager && m.id !== myId ? (
                      <label className="sr-only" htmlFor={`role-${m.id}`}>Role for {m.name}</label>
                    ) : null}
                    {isManager && m.id !== myId ? (
                      <select id={`role-${m.id}`} className="rounded-md border bg-background px-2 py-1 text-sm" defaultValue={m.role}
                        onChange={(e) => act(() => api(`orgs/current/members/${m.id}`, { method: "PATCH", org: orgId, body: { role: e.target.value } }), `${m.name} is now ${roleLabel(e.target.value)}.`)}>
                        {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                      </select>
                    ) : roleLabel(m.role)}
                  </TableCell>
                  {isManager && (
                    <TableCell>{m.id !== myId && <Button size="sm" variant="outline" onClick={() => act(() => api(`orgs/current/members/${m.id}`, { method: "DELETE", org: orgId }), `${m.name} was removed.`)}>Remove</Button>}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
            <CardDescription>They get an email link valid for 7 days and must accept it with the same email address.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1"><TextField id="email" name="email" label="Email" type="email" required /></div>
              <div className="grid gap-1.5">
                <label htmlFor="role" className="text-sm font-medium">Role</label>
                <select id="role" name="role" className="h-9 rounded-md border bg-background px-2 text-sm">
                  {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>
              <Button type="submit">Send invitation</Button>
            </form>
            {invites.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Pending invitation</TableHead><TableHead>Role</TableHead><TableHead>Expires</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {invites.map((i) => (
                      <TableRow key={i.email + i.expires_at}>
                        <TableCell>{i.email}</TableCell>
                        <TableCell>{roleLabel(i.role)}</TableCell>
                        <TableCell>{new Date(i.expires_at).toLocaleDateString()}</TableCell>
                        <TableCell><Button size="sm" variant="outline" onClick={() => act(() => api("orgs/current/invitations/revoke", { org: orgId, body: { email: i.email } }), `Invitation to ${i.email} revoked.`)}>Revoke</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
