"use client";
// Small form building blocks shared by every screen: labelled fields with inline errors, and an error banner.
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

/** Input wired for accessibility: aria-invalid and aria-describedby follow the error/hint. */
export function TextField({ id, label, error, hint, ...props }: { id: string; label: string; error?: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <Input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />
    </Field>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
