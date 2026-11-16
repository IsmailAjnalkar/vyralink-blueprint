"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { FormError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

function Verify() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const [error, setError] = useState<string | null>(token ? null : "This link is missing its token.");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // the link is single use; don't send it twice
    api<{ verified: boolean }>("auth/verify-email", { body: { token } })
      .then(() => {
        router.replace("/app");
        router.refresh();
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn’t confirm your email."));
  }, [token, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle><h1 className="text-xl">Confirming your email</h1></CardTitle>
        <CardDescription>{error ? "That didn’t work." : "One moment…"}</CardDescription>
      </CardHeader>
      {error && (
        <CardContent className="grid gap-3">
          <FormError message={error} />
          <Button asChild variant="outline"><Link href="/login">Go to sign in</Link></Button>
        </CardContent>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
