import { Shell, type NavItem } from "@/components/shell";
import { requireMe, serverApi, type Me, type Membership } from "@/lib/session";

/** Navigation for the current context. Only screens that exist are listed; each phase adds its own. */
function navFor(me: Me, current: Membership | null, unread: number): NavItem[] {
  const brand: NavItem[] = current?.kind === "brand"
    ? [{ href: "/app/campaigns", label: "Campaigns" }, { href: "/app/products", label: "Products" }, { href: "/app/sellers", label: "Find sellers" }, { href: "/app/verification", label: "Verification" }]
    : [];
  const studio: NavItem[] = current?.kind === "operator"
    ? [{ href: "/app/studio", label: "Today" }, { href: "/app/studio/live", label: "LIVE control center" }, { href: "/app/studio/bookings", label: "Bookings" }, { href: "/app/studio/locations", label: "Locations" }]
    : [];
  const seller: NavItem[] = me.sellerProfile
    ? [{ href: "/app/jobs", label: "Jobs" }, { href: "/app/sessions", label: "My sessions" }, { href: "/app/profile", label: "Profile" }, { href: "/app/academy", label: "Academy" }, { href: "/app/earnings", label: "Earnings" }]
    : [];
  const admin: NavItem[] = me.user.is_super_admin || me.user.is_support_admin ? [{ href: "/app/admin", label: "Review queue" }] : [];
  return [
    { href: "/app", label: "Overview" },
    ...brand,
    ...studio,
    ...seller,
    ...admin,
    ...(current ? [{ href: "/app/settings/team", label: "Team" }] : []),
    { href: "/app/notifications", label: unread ? `Notifications (${unread})` : "Notifications" },
    { href: "/app/settings/security", label: "Security" },
  ];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, current } = await requireMe();
  const notes = await serverApi<{ read_at: string | null }[]>("notifications");
  const unread = notes.data?.filter((n) => !n.read_at).length ?? 0;
  return <Shell me={me} current={current} nav={navFor(me, current, unread)}>{children}</Shell>;
}
