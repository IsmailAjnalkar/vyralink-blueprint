"use client";
import Link from "next/link";
import { useState } from "react";
import { FormError, TextField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("auth/password-reset", { body: { email: String(new FormData(e.currentTarget).get("email")) } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t send the link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><h1 className="text-xl">Reset your password</h1></CardTitle>
        <CardDescription>{sent ? "If that email has an account, a reset link is on its way. It expires in 1 hour." : "We’ll email you a link to choose a new password."}</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <Link href="/login" className="text-sm underline">Back to sign in</Link>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <FormError message={error} />
            <TextField id="email" name="email" label="Email" type="email" autoComplete="email" required />
            <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
