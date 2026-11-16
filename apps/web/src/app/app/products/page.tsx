"use client";
// Brand product catalog (blueprint B05): list, add, and send for compliance review.
import Link from "next/link";
import { useState } from "react";
import { Empty, Messages, PageHeader, Status } from "@/components/bits";
import { ProductForm, type Product, type ProductBody } from "@/components/product-form";
import { useSession } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, pct, usd } from "@/lib/api";
import { useAction, useLoad } from "@/lib/use-load";

export default function ProductsPage() {
  const { current } = useSession();
  const org = current?.org_id ?? "";
  const list = useLoad(() => api<Product[]>("products", { org }), org);
  const act = useAction(list.reload);
  const [adding, setAdding] = useState(false);

  async function create(body: ProductBody) {
    const ok = await act.run(() => api("products", { org, body }), `${body.name} saved as a draft. Send it for review when it’s ready.`);
    if (ok) setAdding(false);
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="Products" description="Sellers may only promote approved products, and only with the selling points you list here."
        actions={<Button onClick={() => setAdding((a) => !a)} aria-expanded={adding}>{adding ? "Close" : "Add product"}</Button>} />
      <Messages error={act.error ?? list.error} notice={act.notice} />
      {adding && (
        <Card>
          <CardHeader><CardTitle>New product</CardTitle></CardHeader>
          <CardContent><ProductForm onSubmit={create} busy={act.busy} submitLabel="Save draft" isNew /></CardContent>
        </Card>
      )}
      {list.data?.length === 0 && <Empty>No products yet. Add one to start building a campaign.</Empty>}
      {!!list.data?.length && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Price</TableHead><TableHead>Commission</TableHead><TableHead>Inventory</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Link href={`/app/products/${p.id}`} className="font-medium underline-offset-2 hover:underline">{p.name}</Link></TableCell>
                  <TableCell>{p.sku}</TableCell>
                  <TableCell>{usd(p.price_cents)}</TableCell>
                  <TableCell>{pct(p.commission_bps)}</TableCell>
                  <TableCell>{p.inventory} · {p.samples_available} samples</TableCell>
                  <TableCell><Status value={p.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
