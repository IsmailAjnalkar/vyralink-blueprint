"use client";
// Campaign message thread for brand, seller and studio. The API masks emails and phone numbers.
import { Messages, textareaClass, when } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Msg = { id: string; sender: string; body: string; created_at: string };

export function Thread({ campaignId, org }: { campaignId: string; org?: string }) {
  const msgs = useLoad(() => api<Msg[]>(`campaigns/${campaignId}/messages`, { org }), `${org}:${campaignId}`);
  const act = useAction(msgs.reload);

  async function send(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) return;
    if (await act.run(() => api(`campaigns/${campaignId}/messages`, { org, body: { body } }))) form.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
        <CardDescription>Keep arrangements on Vyralink. Email addresses and phone numbers are hidden automatically.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Messages error={act.error ?? msgs.error} />
        <ul className="grid max-h-80 gap-2 overflow-y-auto" aria-live="polite">
          {msgs.data?.length === 0 && <li className="text-sm text-muted-foreground">No messages yet.</li>}
          {msgs.data?.map((m) => (
            <li key={m.id} className="rounded-md bg-muted/50 p-2 text-sm">
              <span className="font-medium">{m.sender}</span> <span className="text-xs text-muted-foreground">{when(m.created_at)}</span>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={send} className="grid gap-2">
          <label htmlFor={`msg-${campaignId}`} className="sr-only">Message</label>
          <textarea id={`msg-${campaignId}`} name="body" className={textareaClass} placeholder="Write a message" maxLength={4000} />
          <Button type="submit" size="sm" className="w-fit" disabled={act.busy}>Send</Button>
        </form>
      </CardContent>
    </Card>
  );
}
