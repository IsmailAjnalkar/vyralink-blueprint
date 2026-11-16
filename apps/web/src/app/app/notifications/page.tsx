"use client";
// In-app notifications (email delivery is blocked until an email provider is connected). Refreshes every 15 s.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Empty, Messages, PageHeader, when } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Note = { id: string; kind: string; body: string; link: string | null; read_at: string | null; created_at: string };

/** Notification links name API resources; map them to the screen that shows them. */
const href = (link: string | null) => (!link ? null : link.startsWith("/jobs/") ? "/app/jobs" : /^\/(campaigns|contracts)\//.test(link) ? `/app${link}` : null);

export default function NotificationsPage() {
  const router = useRouter();
  const list = useLoad(() => api<Note[]>("notifications"), "notes");
  const act = useAction(async () => { await list.reload(); router.refresh(); });
  useEffect(() => { const t = setInterval(list.reload, 15000); return () => clearInterval(t); }, [list.reload]);
  const unread = list.data?.filter((n) => !n.read_at) ?? [];
  const read = (id: string) => api(`notifications/${id}/read`, { body: {} });

  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Notifications" description={`${unread.length} unread`}
        actions={unread.length > 0 && <Button variant="outline" disabled={act.busy} onClick={() => act.run(() => Promise.all(unread.map((n) => read(n.id))))}>Mark all read</Button>} />
      <Messages error={act.error ?? list.error} />
      {list.data?.length === 0 && <Empty>Nothing yet.</Empty>}
      <ul className="grid gap-2" aria-live="polite">
        {list.data?.map((n) => {
          const to = href(n.link);
          const urgent = n.kind === "incident" && n.body.startsWith("Emergency stop");
          return (
            <li key={n.id} className={`flex flex-wrap items-start gap-3 rounded-md border p-3 text-sm ${urgent ? "border-destructive bg-destructive/5" : n.read_at ? "opacity-70" : ""}`}>
              <Badge variant={urgent ? "destructive" : "outline"}>{n.kind}</Badge>
              <div className="min-w-0 flex-1">
                <p className={n.read_at ? "" : "font-medium"}>{n.body}</p>
                <p className="text-xs text-muted-foreground">{when(n.created_at)}{!n.read_at && " · unread"}</p>
              </div>
              {to && <Link className="underline" href={to} onClick={() => !n.read_at && read(n.id)}>Open</Link>}
              {!n.read_at && <Button size="sm" variant="ghost" disabled={act.busy} onClick={() => act.run(() => read(n.id))}>Mark read</Button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
