"use client";
// LIVE Seller profile (blueprint C02–C04). Track record is computed from completed sessions and can't be edited.
import { Messages, PageHeader, textareaClass } from "@/components/bits";
import { TextField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError, pct, toUnits, usd } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Profile = {
  display_name: string; bio: string | null; city: string | null; categories: string[]; languages: string[]; rate_cents: number | null; commission_bps: number | null; followers_self_reported: string | null;
  verified_sessions: number; verified_gmv_cents: number; verified_gmv_per_hour_cents: number | null; reliability_pct: number | null; certificates: string[];
  identity_verified: boolean; payout_verified: boolean; tax_form_on_file: boolean; no_shows: number;
};
const csv = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export default function ProfilePage() {
  const p = useLoad(() => api<Profile>("seller/profile"), "profile");
  const act = useAction(p.reload);
  const d = p.data;

  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rateCents = toUnits(String(f.get("rate")));
    const commissionBps = toUnits(String(f.get("commission")));
    if (Number.isNaN(rateCents) || Number.isNaN(commissionBps)) return act.run(() => Promise.reject(new ApiError(400, "Enter the rate and commission as numbers, like 90 or 12.5.")));
    // Blank optional text is left out (the API requires non-empty strings when present).
    const opt = (key: string, field: string) => { const v = String(f.get(field) ?? "").trim(); return v ? { [key]: v } : {}; };
    await act.run(() => api("seller/profile", { method: "PUT", body: {
      displayName: String(f.get("displayName")).trim(), bio: String(f.get("bio") ?? ""), ...opt("city", "city"),
      categories: csv(f.get("categories")), languages: csv(f.get("languages")), ...opt("followersSelfReported", "followers"),
      ...(rateCents != null ? { rateCents } : {}), ...(commissionBps != null ? { commissionBps } : {}),
    } }), "Profile saved.");
  }

  if (!d) return <Messages error={p.error} />;
  const checks: [string, boolean][] = [["Identity verified", d.identity_verified], ["Payout account verified", d.payout_verified], ["Tax form on file", d.tax_form_on_file]];
  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader title="Your seller profile" description="Brands see this when they search. Paid jobs need identity and payout verification." />
      <Messages error={act.error} notice={act.notice} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Verified track record</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted-foreground">Completed sessions</dt><dd>{d.verified_sessions}</dd>
              <dt className="text-muted-foreground">GMV / hour</dt><dd>{usd(d.verified_gmv_per_hour_cents)}</dd>
              <dt className="text-muted-foreground">Total GMV</dt><dd>{usd(d.verified_gmv_cents)}</dd>
              <dt className="text-muted-foreground">Reliability</dt><dd>{d.reliability_pct == null ? "—" : `${d.reliability_pct}%`}</dd>
              <dt className="text-muted-foreground">Certificates</dt><dd>{d.certificates.join(", ") || "None yet"}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Account checks</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {checks.map(([k, ok]) => <li key={k}>{ok ? "✓" : "✗"} {k}<span className="sr-only">: {ok ? "done" : "not done"}</span></li>)}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Identity and payout verification run through a payments provider that isn’t connected in this environment. Until then a platform admin marks them in the admin console (sandbox).</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="displayName" name="displayName" label="Display name" defaultValue={d.display_name} required />
              <TextField id="city" name="city" label="City" defaultValue={d.city ?? ""} />
              <TextField id="categories" name="categories" label="Categories" hint="Comma separated, e.g. Skincare, Beauty" defaultValue={d.categories.join(", ")} />
              <TextField id="languages" name="languages" label="Languages" hint="Comma separated" defaultValue={d.languages.join(", ")} />
              <TextField id="rate" name="rate" label="Typical base rate (USD)" inputMode="decimal" defaultValue={d.rate_cents == null ? "" : (d.rate_cents / 100).toFixed(2)} />
              <TextField id="commission" name="commission" label="Typical commission (%)" inputMode="decimal" defaultValue={d.commission_bps == null ? "" : String(d.commission_bps / 100)} hint={d.commission_bps == null ? undefined : `Currently ${pct(d.commission_bps)}`} />
              <TextField id="followers" name="followers" label="Followers (self-reported)" defaultValue={d.followers_self_reported ?? ""} hint="Shown to brands as self-reported" />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="bio" className="text-sm font-medium">Bio</label>
              <textarea id="bio" name="bio" className={textareaClass} defaultValue={d.bio ?? ""} />
            </div>
            <Button type="submit" disabled={act.busy} className="w-fit">Save profile</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
