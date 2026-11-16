import { requireMe } from "@/lib/session";
import { MfaCard, SessionsCard } from "./security-client";

export default async function SecurityPage() {
  const { me } = await requireMe();
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-bold">Security</h1>
      <MfaCard enabled={me.mfa.enabled} required={me.mfa.required} />
      <SessionsCard />
    </div>
  );
}
