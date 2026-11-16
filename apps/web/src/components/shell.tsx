"use client";
// Signed-in shell: organization switcher, portal navigation, sign-out. Navigation lists only screens that exist.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import type { Me, Membership } from "@/lib/session";

export type NavItem = { href: string; label: string };
const ROLE_LABEL: Record<string, string> = {
  brand_owner: "Brand Owner", brand_marketing_manager: "Brand Manager", brand_finance: "Brand Finance",
  location_manager: "Location Manager", producer: "Studio Producer", inventory: "Inventory Coordinator", finance_admin: "Finance Administrator",
};
export const roleLabel = (r: string) => ROLE_LABEL[r] ?? r;

export function Shell({ me, current, nav, children }: { me: Me; current: Membership | null; nav: NavItem[]; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function switchOrg(orgId: string) {
    await fetch("/session/org", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orgId }) });
    router.refresh();
  }
  async function signOut() {
    await api("auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  const context = current ? `${current.name} · ${roleLabel(current.role)}` : me.sellerProfile ? "LIVE Seller" : me.user.is_super_admin ? "Platform admin" : me.user.is_support_admin ? "Platform support" : "No organization";

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <Link href="/app" className="mr-2 text-sm font-extrabold tracking-[0.2em]">VYRALINK</Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label={`Switch organization. Current: ${context}`}>{context} ▾</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
            {me.memberships.length === 0 && <DropdownMenuItem disabled>None yet. Accept an invitation to join one.</DropdownMenuItem>}
            {me.memberships.map((m) => (
              <DropdownMenuItem key={m.org_id} onSelect={() => switchOrg(m.org_id)}>
                {m.name} · {roleLabel(m.role)}{m.org_id === current?.org_id ? " ✓" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">{me.user.name}</span>
          <Button variant="ghost" onClick={signOut}>Sign out</Button>
        </div>
      </header>
      <div className="flex flex-1 flex-wrap">
        <nav aria-label="Main" className="w-full border-b bg-muted/30 p-3 sm:w-56 sm:border-b-0 sm:border-r">
          <ul className="flex flex-wrap gap-1 sm:flex-col">
            {nav.map((n) => {
              const active = n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={active ? "page" : undefined} className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-accent font-semibold" : "hover:bg-accent/60"}`}>{n.label}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
