import { Shell, type NavItem } from "@/components/shell";
import { requireMe, type Me, type Membership } from "@/lib/session";

/** Navigation for the current context. Only screens that exist are listed; each phase adds its own. */
function navFor(me: Me, current: Membership | null): NavItem[] {
  const brand: NavItem[] = current?.kind === "brand"
    ? [{ href: "/app/campaigns", label: "Campaigns" }, { href: "/app/products", label: "Products" }, { href: "/app/sellers", label: "Find sellers" }, { href: "/app/verification", label: "Verification" }]
    : [];
  const seller: NavItem[] = me.sellerProfile
    ? [{ href: "/app/jobs", label: "Jobs" }, { href: "/app/profile", label: "Profile" }, { href: "/app/academy", label: "Academy" }, { href: "/app/earnings", label: "Earnings" }]
    : [];
  const admin: NavItem[] = me.user.is_super_admin || me.user.is_support_admin ? [{ href: "/app/admin", label: "Review queue" }] : [];
  return [
    { href: "/app", label: "Overview" },
    ...brand,
    ...seller,
    ...admin,
    ...(current ? [{ href: "/app/settings/team", label: "Team" }] : []),
    { href: "/app/settings/security", label: "Security" },
  ];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, current } = await requireMe();
  return <Shell me={me} current={current} nav={navFor(me, current)}>{children}</Shell>;
}
