import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { SESSION_COOKIE } from "@/lib/config";

export default async function Home() {
  if ((await cookies()).get(SESSION_COOKIE)) redirect("/app");
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-6 p-8">
      <p className="text-sm font-extrabold tracking-[0.2em]">VYRALINK + CREATOR HUB</p>
      <h1 className="text-4xl font-bold leading-tight">LIVE commerce for brands, sellers and studios</h1>
      <p className="text-lg text-muted-foreground">Brands book vetted LIVE Sellers and Creator Hub studio time, run TikTok Shop LIVE sessions, and see every result, invoice and payout in one place.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg"><Link href="/signup">Create an account</Link></Button>
        <Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button>
      </div>
    </main>
  );
}
