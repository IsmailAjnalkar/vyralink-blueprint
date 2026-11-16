"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FormError, TextField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

function Reset() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 12) return setError("Use at least 12 characters.");
    if (password !== f.get("confirm")) return setError("The two passwords don’t match.");
    setBusy(true);
    setError(null);
    try {
      await api("auth/password-reset/confirm", { body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t reset the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><h1 className="text-xl">Choose a new password</h1></CardTitle>
        <CardDescription>{done ? "Your password is changed and every device was signed out." : "You’ll be signed out everywhere after the change."}</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <Button asChild><Link href="/login">Sign in</Link></Button>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <FormError message={error} />
            <TextField id="password" name="password" label="New password" type="password" autoComplete="new-password" hint="12 or more characters" required />
            <TextField id="confirm" name="confirm" label="Repeat the password" type="password" autoComplete="new-password" required />
            <Button type="submit" disabled={busy || !token}>{busy ? "Saving…" : "Save password"}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><Reset /></Suspense>;
}
