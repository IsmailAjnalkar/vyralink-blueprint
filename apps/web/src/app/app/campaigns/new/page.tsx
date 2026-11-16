"use client";
// Campaign wizard (blueprint B06–B07): steps validate before moving on; the result is a draft the brand publishes from its page.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { Messages, PageHeader, selectClass } from "@/components/bits";
import { Field, TextField } from "@/components/form";
import type { Product } from "@/components/product-form";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, pct, toUnits, usd } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Location = { id: string; name: string; address: string };
type Course = { id: string; title: string };
type V = Record<string, string>;

const STEPS = ["Basics", "Products", "Schedule", "Money", "Requirements", "Review"];
const MONEY: [key: string, label: string, hint?: string][] = [
  ["baseRate", "Seller base rate (USD)", "Paid to the seller for the session"],
  ["commission", "Seller commission (%)", "Blank uses the platform default"],
  ["bonus", "Bonus (USD)", "Optional, paid when GMV reaches the threshold"],
  ["bonusThreshold", "Bonus GMV threshold (USD)"],
  ["productionFee", "Creator Hub production fee (USD)", "Studio, producer and equipment"],
  ["performanceFee", "Performance fee (%)", "Blank uses the platform default"],
  ["budgetCap", "Budget cap (USD)", "The most this campaign may cost you in total"],
  ["targetGmv", "Target GMV (USD)", "Optional"],
];
const PERCENT = new Set(["commission", "performanceFee"]);

export default function NewCampaignPage() {
  const router = useRouter();
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const products = useLoad(() => api<Product[]>("products?status=approved", { org }), org);
  const locations = useLoad(() => api<Location[]>("locations", { org }), org);
  const courses = useLoad(() => api<Course[]>("academy/courses"), "courses");
  const act = useAction();
  const [step, setStep] = useState(0);
  const [v, setV] = useState<V>({ type: "live_shopping", courses: "live_fundamentals" });
  const [stepError, setStepError] = useState<string | null>(null);
  const set = (k: string, val: string) => setV((o) => ({ ...o, [k]: val }));
  const list = (k: string) => (v[k] ?? "").split(",").filter(Boolean);
  const toggle = (k: string, id: string) => set(k, list(k).includes(id) ? list(k).filter((x) => x !== id).join(",") : [...list(k), id].join(","));
  const units = (k: string) => toUnits(v[k]);

  function check(s: number): string | null {
    if (s === 0 && !v.name?.trim()) return "Give the campaign a name.";
    if (s === 1 && !list("products").length) return products.data?.length ? "Pick at least one product." : "You need an approved product first.";
    if (s === 2) {
      if (!v.start || !v.end) return "Choose a start and end time.";
      if (new Date(v.end) <= new Date(v.start)) return "The end must be after the start.";
      if (new Date(v.start) <= new Date()) return "The LIVE must be in the future.";
    }
    if (s === 3) {
      for (const [k, label] of MONEY) if (Number.isNaN(units(k))) return `${label}: enter a number like 90 or 12.5.`;
      for (const k of ["baseRate", "productionFee", "budgetCap"]) if (units(k) == null) return `${MONEY.find((m) => m[0] === k)![1]} is required.`;
      if ([...PERCENT].some((k) => (units(k) ?? 0) > 10000)) return "Percentages can’t exceed 100.";
      if (units("budgetCap")! < units("productionFee")!) return "The budget cap is below the production fee.";
    }
    return null;
  }
  function next() {
    const e = check(step);
    setStepError(e);
    if (!e) setStep(step + 1);
  }

  async function create() {
    for (let s = 0; s < 5; s++) if (check(s)) { setStep(s); return setStepError(check(s)); }
    const opt = (k: string) => (units(k) == null ? {} : { [{ commission: "commissionBps", performanceFee: "performanceFeeBps", bonus: "bonusCents", bonusThreshold: "bonusGmvThresholdCents", targetGmv: "targetGmvCents" }[k]!]: units(k) });
    const body = {
      name: v.name.trim(), type: v.type, productIds: list("products"), ...(v.location ? { locationId: v.location } : {}),
      startsAt: new Date(v.start).toISOString(), endsAt: new Date(v.end).toISOString(),
      baseRateCents: units("baseRate"), productionFeeCents: units("productionFee"), budgetCapCents: units("budgetCap"),
      ...opt("commission"), ...opt("performanceFee"), ...opt("bonus"), ...opt("bonusThreshold"), ...opt("targetGmv"),
      requiredCourses: list("courses"), ...(v.category?.trim() ? { requiredCategory: v.category.trim() } : {}),
    };
    const c = await act.run(() => api<{ id: string }>("campaigns", { org, body }));
    if (c) router.push(`/app/campaigns/${c.id}?created=1`);
  }

  const money = (k: string) => (units(k) == null ? "—" : PERCENT.has(k) ? pct(units(k)) : usd(units(k)));

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/app/campaigns" className="text-sm underline">← Campaigns</Link>
      <PageHeader title="New campaign" description="Saved as a draft. You publish it, hold studio time and invite sellers from the campaign page." />
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={`rounded-full border px-3 py-1 ${i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "bg-muted" : ""}`}>{i + 1}. {s}</li>
        ))}
      </ol>
      <Messages error={stepError ?? act.error ?? products.error ?? locations.error} />
      <Card>
        <CardHeader><CardTitle>{STEPS[step]}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {step === 0 && (
            <>
              <TextField id="name" label="Campaign name" value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. GlowSkin Summer LIVE" />
              <Field id="type" label="Type">
                <select id="type" className={selectClass} value={v.type} onChange={(e) => set("type", e.target.value)}>
                  <option value="live_shopping">LIVE shopping session</option>
                  <option value="live_drop">LIVE product drop</option>
                </select>
              </Field>
            </>
          )}
          {step === 1 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Approved products to feature</legend>
              {products.data?.length === 0 && <p className="text-sm text-muted-foreground">No approved products yet. <Link className="underline" href="/app/products">Add one and send it for review.</Link></p>}
              {products.data?.map((p) => (
                <label key={p.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                  <input type="checkbox" checked={list("products").includes(p.id)} onChange={() => toggle("products", p.id)} />
                  <span className="font-medium">{p.name}</span><span className="text-muted-foreground">{usd(p.price_cents)} · {p.inventory} in stock</span>
                </label>
              ))}
            </fieldset>
          )}
          {step === 2 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="start" label="LIVE starts" type="datetime-local" value={v.start ?? ""} onChange={(e) => set("start", e.target.value)} />
                <TextField id="end" label="LIVE ends" type="datetime-local" value={v.end ?? ""} onChange={(e) => set("end", e.target.value)} />
              </div>
              <Field id="location" label="Creator Hub studio" hint="You pick a booth from the campaign page; the hold reserves setup and teardown time too.">
                <select id="location" className={selectClass} value={v.location ?? ""} onChange={(e) => set("location", e.target.value)}>
                  <option value="">Decide later</option>
                  {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.name}{l.address ? ` · ${l.address}` : ""}</option>)}
                </select>
              </Field>
            </>
          )}
          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {MONEY.map(([k, label, hint]) => <TextField key={k} id={k} label={label} hint={hint} inputMode="decimal" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} />)}
            </div>
          )}
          {step === 4 && (
            <>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Training the seller must have passed</legend>
                {courses.data?.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={list("courses").includes(c.id)} onChange={() => toggle("courses", c.id)} /> {c.title}
                  </label>
                ))}
              </fieldset>
              <TextField id="category" label="Seller category (optional)" placeholder="e.g. Skincare" value={v.category ?? ""} onChange={(e) => set("category", e.target.value)} />
            </>
          )}
          {step === 5 && (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <dt className="text-muted-foreground">Name</dt><dd>{v.name}</dd>
              <dt className="text-muted-foreground">Products</dt><dd>{products.data?.filter((p) => list("products").includes(p.id)).map((p) => p.name).join(", ")}</dd>
              <dt className="text-muted-foreground">When</dt><dd>{v.start && new Date(v.start).toLocaleString()} – {v.end && new Date(v.end).toLocaleTimeString()}</dd>
              <dt className="text-muted-foreground">Studio</dt><dd>{locations.data?.find((l) => l.id === v.location)?.name ?? "Decide later"}</dd>
              {MONEY.map(([k, label]) => <Fragment key={k}><dt className="text-muted-foreground">{label}</dt><dd>{money(k)}</dd></Fragment>)}
              <dt className="text-muted-foreground">Training</dt><dd>{list("courses").join(", ") || "None"}</dd>
            </dl>
          )}
          <div className="flex gap-2 pt-2">
            {step > 0 && <Button variant="outline" onClick={() => { setStepError(null); setStep(step - 1); }}>Back</Button>}
            {step < 5 ? <Button onClick={next}>Continue</Button> : <Button onClick={create} disabled={act.busy}>{act.busy ? "Saving…" : "Save draft"}</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
