"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError, TextField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

const schema = z.object({ email: z.email("Enter a valid email"), password: z.string().min(1, "Enter your password") });
const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [error, setError] = useState<string | null>(null);
  const pw = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const mfa = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema) });

  const signIn = pw.handleSubmit(async (values) => {
    setError(null);
    try {
      const r = await api<{ mfaRequired?: boolean }>("auth/login", { body: values });
      if (r.mfaRequired) return setStep("mfa");
      router.push("/app");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn’t sign in. Try again.");
    }
  });
  const verify = mfa.handleSubmit(async (values) => {
    setError(null);
    try {
      await api("auth/mfa/verify", { body: values });
      router.push("/app");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "unauthenticated") setStep("password");
      setError(e instanceof ApiError ? e.message : "Couldn’t verify the code.");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle><h1 className="text-xl">{step === "password" ? "Sign in" : "Two-step verification"}</h1></CardTitle>
        <CardDescription>{step === "password" ? "Brands, LIVE Sellers and Creator Hub staff sign in here." : "Enter the 6-digit code from your authenticator app."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormError message={error} />
        {step === "password" ? (
          <form onSubmit={signIn} className="grid gap-4" noValidate>
            <TextField id="email" label="Email" type="email" autoComplete="email" error={pw.formState.errors.email?.message} {...pw.register("email")} />
            <TextField id="password" label="Password" type="password" autoComplete="current-password" error={pw.formState.errors.password?.message} {...pw.register("password")} />
            <Button type="submit" disabled={pw.formState.isSubmitting}>{pw.formState.isSubmitting ? "Signing in…" : "Sign in"}</Button>
            <div className="flex justify-between text-sm">
              <Link href="/forgot-password" className="underline">Forgot password?</Link>
              <Link href="/signup" className="underline">Create an account</Link>
            </div>
          </form>
        ) : (
          <form onSubmit={verify} className="grid gap-4" noValidate>
            <TextField id="code" label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} error={mfa.formState.errors.code?.message} {...mfa.register("code")} />
            <Button type="submit" disabled={mfa.formState.isSubmitting}>{mfa.formState.isSubmitting ? "Checking…" : "Verify"}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
