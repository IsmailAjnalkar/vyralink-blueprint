"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Messages, PageHeader, Status } from "@/components/bits";
import { ProductForm, type Product, type ProductBody } from "@/components/product-form";
import { useSession } from "@/components/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const p = useLoad(() => api<Product>(`products/${id}`, { org }), `${org}:${id}`);
  const act = useAction(p.reload);
  const product = p.data;

  const save = (body: ProductBody) =>
    act.run(() => api<Product>(`products/${id}`, { method: "PATCH", org, body }), (r) => (r.status === "pending_review" && product?.status === "approved" ? "Saved. The claims changed, so it went back to review." : "Saved."));

  return (
    <div className="grid max-w-4xl gap-6">
      <Link href="/app/products" className="text-sm underline">← Products</Link>
      <PageHeader title={product?.name ?? "Product"} description={product && <>Status: <Status value={product.status} /></>}
        actions={product && (
          <>
            {["draft", "rejected"].includes(product.status) && <Button disabled={act.busy} onClick={() => act.run(() => api(`products/${id}/submit`, { org, method: "POST" }), "Sent for review.")}>Send for review</Button>}
            {product.status === "approved" && <Button variant="outline" disabled={act.busy} onClick={() => act.run(() => api(`products/${id}/archive`, { org, method: "POST" }), "Archived.")}>Archive</Button>}
          </>
        )} />
      <Messages error={act.error ?? p.error} notice={act.notice} />
      {product?.review_note && (
        <Alert><AlertDescription><strong>Reviewer note:</strong> {product.review_note}</AlertDescription></Alert>
      )}
      {product && (
        <Card>
          <CardContent className="pt-6"><ProductForm key={product.status + product.name} initial={product} onSubmit={save} busy={act.busy} submitLabel="Save changes" /></CardContent>
        </Card>
      )}
    </div>
  );
}
