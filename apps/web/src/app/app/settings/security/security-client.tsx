"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormError, TextField } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";

type Session = { id: string; created_at: string; last_seen_at: string; user_agent: string | null; ip: string | null; current: boolean };

export function MfaCard({ enabled, required }: { enabled: boolean; required: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setError(null);
    try { setSetup(await api("auth/mfa/setup", { method: "POST" })); } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn’t start setup."); }
  }
  async function enable(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("auth/mfa/enable", { body: { code: String(new FormData(e.currentTarget).get("code")) } });
      setSetup(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code didn’t work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Two-step verification <Badge variant={enabled ? "default" : "outline"}>{enabled ? "On" : "Off"}</Badge></CardTitle>
        <CardDescription>{enabled ? "Signing in asks for a code from your authenticator app." : required ? "Required for your role before you can use finance or admin screens." : "Add a code from an authenticator app to every sign-in."}</CardDescription>
      </CardHeader>
      {!enabled && (
        <CardContent className="grid gap-4">
          <FormError message={error} />
          {!setup ? (
            <Button className="w-fit" onClick={start}>Set up two-step verification</Button>
          ) : (
            <form onSubmit={enable} className="grid gap-3">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Open your authenticator app and add an account with this key (or open the link on your phone):</li>
              </ol>
              <code className="break-all rounded bg-muted p-2 text-sm" aria-label="Setup key">{setup.secret}</code>
              <a href={setup.otpauthUrl} className="text-sm underline">Open in authenticator app</a>
              <TextField id="code" name="code" label="Enter the 6-digit code it shows" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
              <Button type="submit" className="w-fit" disabled={busy}>{busy ? "Checking…" : "Turn on"}</Button>
              <p className="text-xs text-muted-foreground">Turning it on signs out your other devices; they sign in again with a code.</p>
            </form>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function SessionsCard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<Session[]>("auth/sessions").then(setSessions).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn’t load sessions.")), []);
  useEffect(() => { load(); }, [load]);

  async function revoke(id: string) {
    await api(`auth/sessions/${id}`, { method: "DELETE" });
    load();
  }
  async function everywhere() {
    await api("auth/logout-all", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where you’re signed in</CardTitle>
        <CardDescription>Sign out a device you don’t recognize.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <FormError message={error} />
        {sessions === null ? (
          <p className="text-sm text-muted-foreground" aria-busy="true">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Last active</TableHead><TableHead>IP</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-xs truncate">{s.user_agent || "Unknown"} {s.current && <Badge className="ml-1">This device</Badge>}</TableCell>
                    <TableCell>{new Date(s.last_seen_at).toLocaleString()}</TableCell>
                    <TableCell>{s.ip ?? "—"}</TableCell>
                    <TableCell>{!s.current && <Button size="sm" variant="outline" onClick={() => revoke(s.id)}>Sign out</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Button variant="outline" className="w-fit" onClick={everywhere}>Sign out everywhere</Button>
      </CardContent>
    </Card>
  );
}
