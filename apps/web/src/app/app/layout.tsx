import { Shell, type NavItem } from "@/components/shell";
import { requireMe } from "@/lib/session";

/** Navigation for the current context. Only screens that exist are listed; each phase adds its own. */
function navFor(kind: string | undefined): NavItem[] {
  return [
    { href: "/app", label: "Overview" },
    ...(kind ? [{ href: "/app/settings/team", label: "Team" }] : []),
    { href: "/app/settings/security", label: "Security" },
  ];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, current } = await requireMe();
  return <Shell me={me} current={current} nav={navFor(current?.kind)}>{children}</Shell>;
}
