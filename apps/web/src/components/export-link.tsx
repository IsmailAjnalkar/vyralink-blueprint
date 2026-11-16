// Accounting CSV download through the same-origin proxy (cookie session; the API scopes rows to the organization).
import { Button } from "@/components/ui/button";

export function ExportLink({ kind, org, label }: { kind: "invoices" | "ledger" | "payouts"; org: string; label?: string }) {
  return <Button asChild variant="outline" size="sm"><a href={`/api/exports/${kind}?org=${org}`} download>{label ?? `Export ${kind} (CSV)`}</a></Button>;
}
