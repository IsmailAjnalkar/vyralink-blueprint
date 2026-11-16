import { redirect } from "next/navigation";
import { requireMe } from "@/lib/session";
import { Team } from "./team-client";

const ROLES = { brand: ["brand_owner", "brand_marketing_manager", "brand_finance"], operator: ["location_manager", "producer", "inventory", "finance_admin"] };

export default async function TeamPage() {
  const { me, current } = await requireMe();
  if (!current) redirect("/app");
  const isManager = current.role === "brand_owner" || current.role === "location_manager";
  return (
    <div className="grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-bold">Team · {current.name}</h1>
        <p className="text-sm text-muted-foreground">{isManager ? "Invite people, change roles and remove members." : "Only owners and location managers can change the team."}</p>
      </div>
      <Team orgId={current.org_id} roles={ROLES[current.kind]} isManager={isManager} myId={me.user.id} />
    </div>
  );
}
