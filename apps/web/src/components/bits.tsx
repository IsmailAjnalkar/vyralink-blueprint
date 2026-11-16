// Small shared pieces for portal screens.
import type { ReactNode } from "react";
import { FormError } from "@/components/form";
import { Badge } from "@/components/ui/badge";

const GOOD = new Set(["approved", "verified", "published", "accepted", "scheduled", "completed", "paid", "confirmed", "signed"]);
const BAD = new Set(["rejected", "declined", "cancelled", "expired", "withdrawn", "no_show", "void", "failed", "on_hold", "disputed"]);

/** Status as text plus color; color is never the only signal. */
export function Status({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  const variant = GOOD.has(value) ? "default" : BAD.has(value) ? "destructive" : "outline";
  return <Badge variant={variant}>{value.replace(/_/g, " ")}</Badge>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Messages({ error, notice }: { error?: string | null; notice?: string | null }) {
  return (
    <>
      <FormError message={error} />
      {notice && <p role="status" className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">{notice}</p>}
    </>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Native select styled like the inputs. */
export const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";
export const textareaClass = "min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm";
