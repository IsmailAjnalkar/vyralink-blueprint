"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FormError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

type Preview = { org: string; role: string; email: string; expired: boolean; used: boolean };

function Invite() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [signedIn, setSignedIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Preview>("invitations/preview", { body: { token } }).then(setPreview).catch((e) => setError(e instanceof ApiError ? e.message : "This invitation is invalid."));
    api<{ user: { email: string } }>("me").then((m) => setSignedIn(m.user.email)).catch(() => setSignedIn(null));
  }, [token]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ orgId: string }>("invitations/accept", { body: { token } });
      await fetch("/session/org", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orgId: r.orgId }) });
      router.push("/app");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn’t accept the invitation.");
    } finally {
      setBusy(false);
    }
  }

  const role = preview?.role.replace(/_/g, " ");
  return (
    <Card>
      <CardHeader>
        <CardTitle><h1 className="text-xl">{preview ? `Join ${preview.org}` : "Invitation"}</h1></CardTitle>
        {preview && <CardDescription>You’ve been invited as <b>{role}</b>. The invitation is for {preview.email}.</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-3">
        <FormError message={error ?? (preview?.expired ? "This invitation has expired. Ask for a new one." : preview?.used ? "This invitation was already used." : null)} />
        {preview && !preview.expired && !preview.used && (signedIn ? (
          signedIn.toLowerCase() === preview.email ? (
            <Button onClick={accept} disabled={busy}>{busy ? "Joining…" : `Join as ${role}`}</Button>
          ) : (
            <p className="text-sm">You’re signed in as {signedIn}. Sign out and sign in with {preview.email} to accept.</p>
          )
        ) : (
          <div className="flex gap-2">
            <Button asChild><Link href="/login">Sign in</Link></Button>
            <Button asChild variant="outline"><Link href="/signup">Create an account</Link></Button>
          </div>
        ))}
        {preview && !signedIn && <p className="text-xs text-muted-foreground">After signing in, open the invitation link again to accept it.</p>}
      </CardContent>
    </Card>
  );
}

export default function InvitePage() {
  return <Suspense><Invite /></Suspense>;
}
