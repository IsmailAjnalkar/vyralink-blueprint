"use client";
// Opens a dispute on an invoice (brand billing) or a completed session (brand or seller).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Messages, selectClass, textareaClass } from "@/components/bits";
import { Field, TextField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError, toUnits } from "@/lib/api";
import { useAction } from "@/lib/use-load";

const TYPES: Record<string, string> = { invoice: "Invoice amount", cancellation_fee: "Cancellation fee", attribution: "Orders attributed to the LIVE", commission: "Commission paid", deliverables: "Session didn’t meet the brief" };

export function OpenDispute({ org, target, types, label = "Dispute" }: { org?: string; target: { invoiceId: string } | { bookingId: string }; types: string[]; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const act = useAction();
  const key = "invoiceId" in target ? target.invoiceId : target.bookingId;

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const amountCents = toUnits(String(f.get("amount")) || "0");
    if (amountCents == null || Number.isNaN(amountCents)) return act.run(() => Promise.reject(new ApiError(400, "Enter the disputed amount like 50.00.")));
    const d = await act.run(() => api<{ id: string }>("disputes", { org, body: { type: String(f.get("type")), amountCents, claim: String(f.get("claim")).trim(), ...target } }));
    if (d) router.push(`/app/disputes/${d.id}`);
  }

  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <form onSubmit={submit} className="grid gap-2 rounded-md border p-3 text-left">
      <Messages error={act.error} />
      <Field id={`dt-${key}`} label="What is disputed">
        <select id={`dt-${key}`} name="type" className={selectClass}>{types.map((t) => <option key={t} value={t}>{TYPES[t]}</option>)}</select>
      </Field>
      <TextField id={`da-${key}`} name="amount" label="Disputed amount (USD)" inputMode="decimal" required />
      <label htmlFor={`dc-${key}`} className="text-sm font-medium">What happened</label>
      <textarea id={`dc-${key}`} name="claim" required className={textareaClass} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={act.busy}>Open dispute</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
