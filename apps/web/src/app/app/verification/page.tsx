"use client";
// Brand company verification (blueprint B03): company details plus documents, uploaded through the storage provider.
import { TextField } from "@/components/form";
import { Messages, PageHeader, Status, textareaClass, when } from "@/components/bits";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError, uploadFile } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

type Verification = { id: string; version: number; status: string; note: string | null; details: Record<string, string>; documents: { type: string; fileName: string; fileId?: string }[]; created_at: string };
const DOCS = [
  { type: "registration", label: "Business registration" },
  { type: "tax_id", label: "Tax ID letter" },
  { type: "brand_authorization", label: "Brand ownership or authorization" },
];

export default function VerificationPage() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const list = useLoad(() => api<Verification[]>("orgs/current/verification", { org }), org);
  const act = useAction(list.reload);
  const canSubmit = current?.role === "brand_owner" && !["verified", "submitted", "in_review"].includes(current.status);

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const details = Object.fromEntries(["legalName", "registrationNumber", "country", "website", "contactPhone", "notes"].map((k) => [k, String(f.get(k) ?? "")]));
    const picked = DOCS.map((d) => [d.type, f.get(`doc-${d.type}`)] as const).filter((x): x is readonly [string, File] => x[1] instanceof File && x[1].size > 0);
    await act.run(async () => {
      if (!picked.length) throw new ApiError(400, "Attach at least one document.");
      const documents = await Promise.all(picked.map(async ([type, file]) => ({ type, fileName: file.name, fileId: (await uploadFile("verification_document", file, org)).id })));
      return api("orgs/current/verification", { org, body: { details, documents } });
    }, "Submitted. A Vyralink reviewer will check it, usually within 2 business days.");
  }

  if (current?.kind !== "brand") return <PageHeader title="Company verification" description="Only brand organizations are verified here." />;
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Company verification" description={<>Publishing campaigns, inviting sellers and holding studio time unlock once {current.name} is verified. Current status: <Status value={current.status} /></>} />
      <Messages error={act.error ?? list.error} notice={act.notice} />

      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle>Submit your details</CardTitle>
            <CardDescription>Only a Brand Owner can submit. Each resubmission is kept as a new version.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              <TextField id="legalName" name="legalName" label="Legal company name" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="registrationNumber" name="registrationNumber" label="Registration number" required />
                <TextField id="country" name="country" label="Country of registration" defaultValue="United States" required />
                <TextField id="website" name="website" label="Website" type="url" placeholder="https://" />
                <TextField id="contactPhone" name="contactPhone" label="Contact phone" type="tel" />
              </div>
              <fieldset className="grid gap-3 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Documents</legend>
                <p className="text-xs text-muted-foreground">PDF, PNG or JPEG, up to 10 MB each. Only your organization and Vyralink reviewers can open them.</p>
                {DOCS.map((d) => (
                  <div key={d.type} className="grid gap-1.5">
                    <label htmlFor={`doc-${d.type}`} className="text-sm font-medium">{d.label}</label>
                    <input id={`doc-${d.type}`} name={`doc-${d.type}`} type="file" accept="application/pdf,image/png,image/jpeg" className="text-sm" />
                  </div>
                ))}
              </fieldset>
              <div className="grid gap-1.5">
                <label htmlFor="notes" className="text-sm font-medium">Anything the reviewer should know</label>
                <textarea id="notes" name="notes" className={textareaClass} />
              </div>
              <Button type="submit" disabled={act.busy} className="w-fit">Submit for verification</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="history" className="grid gap-3">
        <h2 id="history" className="text-lg font-semibold">Submissions</h2>
        {list.data?.length === 0 && <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>}
        {list.data?.map((v) => (
          <Card key={v.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Version {v.version} <Status value={v.status} /></CardTitle>
              <CardDescription>{when(v.created_at)} · {v.details.legalName} · {v.documents.map((d, i) => <span key={i}>{i ? ", " : ""}{d.fileId ? <a className="underline" href={`/api/files/${d.fileId}?org=${org}`}>{d.fileName}</a> : d.fileName}</span>)}</CardDescription>
            </CardHeader>
            {v.note && <CardContent className="text-sm"><strong>Reviewer note:</strong> {v.note}</CardContent>}
          </Card>
        ))}
      </section>
    </div>
  );
}
