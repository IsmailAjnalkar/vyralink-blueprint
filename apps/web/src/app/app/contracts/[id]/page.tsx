"use client";
// Contract review and typed-name signature (blueprint B14 / C12). Brand Owner and seller each sign the same version.
import { useParams } from "next/navigation";
import { Messages, PageHeader, Status, when } from "@/components/bits";
import { TextField } from "@/components/form";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, pct, usd } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Terms = {
  baseRateCents: number; commissionBps: number; bonusCents: number; bonusGmvThresholdCents: number | null; startsAt: string; endsAt: string; arrivalLeadMin: number;
  paidBy: string; eligibleSalesDefinition: string; affiliateCommissionRule: string; cancellationPolicy: string;
};
type Contract = { id: string; campaign: string; version: number; void: boolean; seller_id: string; brand_signed_at: string | null; seller_signed_at: string | null; terms: Terms };

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const { me, current } = useSession();
  const org = current?.org_id;
  const k = useLoad(() => api<Contract>(`contracts/${id}`, { org }), `${org}:${id}`);
  const act = useAction(k.reload);
  const c = k.data;
  const isSeller = c?.seller_id === me.user.id;
  const mySignature = c && (isSeller ? c.seller_signed_at : c.brand_signed_at);
  const canSign = c && !c.void && !mySignature && (isSeller || current?.role === "brand_owner");

  async function sign(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const typedName = String(new FormData(e.currentTarget).get("typedName") ?? "").trim();
    await act.run<{ brandSigned: boolean; sellerSigned: boolean }>(() => api(`contracts/${id}/sign`, { org, body: { typedName } }),
      (r) => (r.brandSigned && r.sellerSigned ? "Signed by both. The seller is booked; the studio confirms the session next." : "Signed. Waiting for the other side."));
  }

  if (!c) return <Messages error={k.error} />;
  const t = c.terms;
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title={`${c.campaign}: contract v${c.version}`} description={c.void ? <Status value="void" /> : "Paid by Creator Hub. Read every term before signing."} />
      <Messages error={act.error} notice={act.notice} />
      <Card>
        <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            {[
              ["LIVE session", `${when(t.startsAt)} – ${new Date(t.endsAt).toLocaleTimeString([], { timeStyle: "short" })}. Arrive ${t.arrivalLeadMin} minutes early.`],
              ["Base rate", usd(t.baseRateCents)],
              ["Commission", `${pct(t.commissionBps)} of eligible sales`],
              ["Bonus", t.bonusCents ? `${usd(t.bonusCents)} when eligible GMV reaches ${usd(t.bonusGmvThresholdCents)}` : "None"],
              ["Eligible sales", t.eligibleSalesDefinition],
              ["TikTok Shop affiliate commission", t.affiliateCommissionRule],
              ["Cancellation", t.cancellationPolicy],
              ["Paid by", t.paidBy],
            ].map(([k2, v]) => <div key={k2}><dt className="font-medium">{k2}</dt><dd className="text-muted-foreground">{v}</dd></div>)}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Signatures</CardTitle>
          <CardDescription>Brand: {c.brand_signed_at ? `signed ${when(c.brand_signed_at)}` : "not yet"} · Seller: {c.seller_signed_at ? `signed ${when(c.seller_signed_at)}` : "not yet"}</CardDescription>
        </CardHeader>
        {canSign && (
          <CardContent>
            <form onSubmit={sign} className="grid gap-3">
              <TextField id="typedName" name="typedName" label="Type your full legal name to sign" defaultValue="" required autoComplete="name" hint={`Signing as ${me.user.name}${isSeller ? "" : ` for ${current?.name}`}`} />
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" /> I have read these terms and agree to them.</label>
              <Button type="submit" disabled={act.busy} className="w-fit">Sign contract</Button>
            </form>
          </CardContent>
        )}
        {!canSign && !mySignature && !c.void && !isSeller && <CardContent className="text-sm text-muted-foreground">Only a Brand Owner can sign for {current?.name}.</CardContent>}
      </Card>
    </div>
  );
}
