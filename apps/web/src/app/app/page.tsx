import Link from "next/link";
import { roleLabel } from "@/lib/roles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMe } from "@/lib/session";

export default async function OverviewPage() {
  const { me, current } = await requireMe();
  const needsMfa = me.mfa.required && !me.mfa.enabled;

  return (
    <div className="grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {me.user.name}</h1>
        <p className="text-sm text-muted-foreground">{me.user.email}</p>
      </div>

      {needsMfa && (
        <Alert>
          <AlertTitle>Turn on two-step verification</AlertTitle>
          <AlertDescription>
            Your role handles money or platform settings, so those screens stay locked until two-step verification is on.
            <Button asChild size="sm" className="mt-2 w-fit"><Link href="/app/settings/security">Set it up</Link></Button>
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="orgs" className="grid gap-3">
        <h2 id="orgs" className="text-lg font-semibold">Your organizations</h2>
        {me.memberships.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No organization yet</CardTitle>
              <CardDescription>{me.sellerProfile ? "As a LIVE Seller you work from your own profile. Brands find you in discovery." : "Ask your organization to send you an invitation, then open the link in the email."}</CardDescription>
            </CardHeader>
          </Card>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {me.memberships.map((m) => (
            <Card key={m.org_id} className={m.org_id === current?.org_id ? "border-primary" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">{m.name}{m.org_id === current?.org_id && <Badge>Current</Badge>}</CardTitle>
                <CardDescription>{m.kind === "brand" ? "Brand" : "Creator Hub"} · {roleLabel(m.role)}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                Status: <Badge variant={m.status === "verified" ? "default" : "outline"}>{m.status.replace(/_/g, " ")}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
