"use client";
import { useState } from "react";
import { FormError, TextField } from "@/components/form";
import { textareaClass } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { toUnits } from "@/lib/api";

export type Product = {
  id: string; name: string; sku: string; price_cents: number; category: string; inventory: number; samples_available: number; commission_bps: number;
  description: string; selling_points: string[]; restricted_claims: string[]; status: string; review_note: string | null;
};
export type ProductBody = { name: string; sku?: string; category?: string; priceCents: number; inventory: number; samplesAvailable: number; commissionBps?: number; description: string; sellingPoints: string[]; restrictedClaims: string[] };

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
const int = (v: FormDataEntryValue | null) => (String(v ?? "").trim() === "" ? 0 : Number(v));

/** Product fields; money and percentages are parsed to integer cents/basis points before they leave the form. */
export function ProductForm({ initial, onSubmit, busy, submitLabel, isNew }: { initial?: Product; onSubmit: (b: ProductBody) => unknown; busy: boolean; submitLabel: string; isNew?: boolean }) {
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const priceCents = toUnits(String(f.get("price")));
    const commission = toUnits(String(f.get("commission")));
    const inventory = int(f.get("inventory"));
    const samplesAvailable = int(f.get("samples"));
    if (!priceCents || Number.isNaN(priceCents)) return setError("Enter a price like 34.99.");
    if (commission !== null && (Number.isNaN(commission) || commission > 10000)) return setError("Commission is a percent between 0 and 100, like 10 or 12.5.");
    if (![inventory, samplesAvailable].every((n) => Number.isInteger(n) && n >= 0)) return setError("Inventory and samples are whole numbers.");
    setError(null);
    onSubmit({
      name: String(f.get("name")).trim(),
      ...(isNew ? { sku: String(f.get("sku")).trim(), category: String(f.get("category")).trim() } : {}),
      priceCents, inventory, samplesAvailable, ...(commission !== null ? { commissionBps: commission } : {}),
      description: String(f.get("description") ?? ""), sellingPoints: lines(f.get("sellingPoints")), restrictedClaims: lines(f.get("restrictedClaims")),
    });
  }

  const p = initial;
  return (
    <form onSubmit={submit} className="grid gap-4">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="name" name="name" label="Product name" defaultValue={p?.name} required />
        <TextField id="sku" name="sku" label="SKU" defaultValue={p?.sku} required disabled={!isNew} hint={isNew ? undefined : "SKU and category can’t change after creation"} />
        <TextField id="category" name="category" label="Category" defaultValue={p?.category} placeholder="e.g. Skincare" required disabled={!isNew} />
        <TextField id="price" name="price" label="Price (USD)" inputMode="decimal" defaultValue={p ? (p.price_cents / 100).toFixed(2) : ""} placeholder="34.99" required />
        <TextField id="commission" name="commission" label="Seller commission (%)" inputMode="decimal" defaultValue={p ? String(p.commission_bps / 100) : ""} hint="Blank uses the platform default" />
        <div className="grid grid-cols-2 gap-4">
          <TextField id="inventory" name="inventory" label="Inventory" type="number" min={0} defaultValue={p?.inventory ?? 0} />
          <TextField id="samples" name="samples" label="Samples" type="number" min={0} defaultValue={p?.samples_available ?? 0} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">Description</label>
        <textarea id="description" name="description" className={textareaClass} defaultValue={p?.description} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="sellingPoints" className="text-sm font-medium">Approved selling points (one per line)</label>
          <textarea id="sellingPoints" name="sellingPoints" className={textareaClass} defaultValue={p?.selling_points.join("\n")} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="restrictedClaims" className="text-sm font-medium">Claims sellers must not make (one per line)</label>
          <textarea id="restrictedClaims" name="restrictedClaims" className={textareaClass} defaultValue={p?.restricted_claims.join("\n")} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Product images need object storage, which isn’t configured in this environment yet.</p>
      <Button type="submit" disabled={busy} className="w-fit">{submitLabel}</Button>
    </form>
  );
}
