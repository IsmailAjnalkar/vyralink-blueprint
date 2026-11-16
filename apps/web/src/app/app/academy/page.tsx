"use client";
// Creator Hub Academy (blueprint C07): courses, knowledge checks, certificates. The answer key stays on the server.
import { useState } from "react";
import { Messages, PageHeader } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Course = { id: string; title: string; questions: number; passPct: number };
type Assessment = { course: string; title: string; passPct: number; questions: { q: string; options: string[] }[] };
type Result = { score: number; passed: boolean; passPct: number; retakeAfterHours?: number };

export default function AcademyPage() {
  const courses = useLoad(() => api<Course[]>("academy/courses"), "courses");
  const profile = useLoad(() => api<{ certificates: string[] }>("seller/profile"), "profile");
  const [open, setOpen] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const act = useAction(profile.reload);
  const certs = new Set(profile.data?.certificates ?? []);

  async function start(id: string) {
    const a = await act.run(() => api<Assessment>(`academy/${id}/assessment`));
    if (a) { setOpen(a); setAnswers(Array(a.questions.length).fill(-1)); }
  }
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!open) return;
    const r = await act.run<Result>(() => api(`academy/${open.course}/assessment`, { body: { answers } }),
      (r) => (r.passed ? `Passed with ${r.score}%. Certificate added to your profile.` : `Scored ${r.score}% (pass mark ${r.passPct}%). You can retake it in ${r.retakeAfterHours} hours.`));
    if (r) setOpen(null);
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Creator Hub Academy" description="Some campaigns require a certificate before you can accept them." />
      <Messages error={act.error ?? courses.error} notice={act.notice} />
      {open ? (
        <Card>
          <CardHeader><CardTitle>{open.title}</CardTitle><CardDescription>Answer every question. Pass mark {open.passPct}%.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-5">
              {open.questions.map((q, i) => (
                <fieldset key={i} className="grid gap-2">
                  <legend className="mb-1 text-sm font-medium">{i + 1}. {q.q}</legend>
                  {q.options.map((o, j) => (
                    <label key={j} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`q${i}`} required checked={answers[i] === j} onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))} /> {o}
                    </label>
                  ))}
                </fieldset>
              ))}
              <div className="flex gap-2">
                <Button type="submit" disabled={act.busy}>Submit answers</Button>
                <Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {courses.data?.map((c) => (
            <li key={c.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">{c.title}{certs.has(c.id) && <Badge>Certified</Badge>}</CardTitle>
                  <CardDescription>{c.questions} questions · pass mark {c.passPct}%</CardDescription>
                </CardHeader>
                <CardContent><Button size="sm" variant={certs.has(c.id) ? "outline" : "default"} onClick={() => start(c.id)} disabled={act.busy}>{certs.has(c.id) ? "Retake" : "Take the knowledge check"}</Button></CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
