"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError, TextField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

const schema = z
  .object({
    kind: z.enum(["brand", "seller", "staff"]),
    name: z.string().trim().min(1, "Enter your name"),
    companyName: z.string().trim().optional(),
    email: z.email("Enter a valid email"),
    password: z.string().min(12, "Use at least 12 characters"),
    terms: z.literal(true, { message: "Accept the terms to continue" }),
  })
  .refine((v) => v.kind !== "brand" || (v.companyName ?? "").length > 0, { path: ["companyName"], message: "Enter your company name" });
type Values = z.infer<typeof schema>;

const KINDS = [
  { value: "brand", label: "Brand", hint: "Sell your products through LIVE sessions" },
  { value: "seller", label: "LIVE Seller", hint: "Host LIVE shopping shows at Creator Hub studios" },
  { value: "staff", label: "Creator Hub staff", hint: "You’ll join your studio by invitation" },
] as const;

export default function SignupPage() {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { kind: "brand" } });
  const kind = form.watch("kind");
  const e = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const { kind, name, email, password, companyName } = values; // terms is a UI-only consent check
      await api("auth/signup", { body: { kind, name, email, password, companyName: kind === "brand" ? companyName : undefined } });
      setDone(values.email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t create the account. Try again.");
    }
  });

  if (done)
    return (
      <Card>
        <CardHeader>
          <CardTitle><h1 className="text-xl">Check your inbox</h1></CardTitle>
          <CardDescription>We sent a confirmation link to {done}. It expires in 24 hours.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          Didn’t get it? <button type="button" className="underline" onClick={() => api("auth/resend-verification", { body: { email: done } })}>Send it again</button>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle><h1 className="text-xl">Create your account</h1></CardTitle>
        <CardDescription>Already have one? <Link href="/login" className="underline">Sign in</Link></CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">I am a…</legend>
            {KINDS.map((k) => (
              <label key={k.value} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary">
                <input type="radio" value={k.value} className="mt-1" {...form.register("kind")} />
                <span><span className="block text-sm font-medium">{k.label}</span><span className="block text-xs text-muted-foreground">{k.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <TextField id="name" label="Your name" autoComplete="name" error={e.name?.message} {...form.register("name")} />
          {kind === "brand" && <TextField id="companyName" label="Company name" autoComplete="organization" error={e.companyName?.message} {...form.register("companyName")} />}
          <TextField id="email" label="Work email" type="email" autoComplete="email" error={e.email?.message} {...form.register("email")} />
          <TextField id="password" label="Password" type="password" autoComplete="new-password" hint="12 or more characters" error={e.password?.message} {...form.register("password")} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" {...form.register("terms")} />
            <span>I agree to the Terms of Service{kind === "brand" ? " and the Brand Agreement" : kind === "seller" ? " and the Creator Agreement" : ""}.</span>
          </label>
          {e.terms && <p role="alert" className="text-xs font-medium text-destructive">{e.terms.message}</p>}
          <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creating…" : "Create account"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
