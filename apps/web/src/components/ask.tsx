"use client";
// Accessible replacement for window.prompt / window.confirm: one Radix dialog (focus trap, Escape, labelled fields),
// opened from anywhere through a promise. ask() resolves with the field values, or null when cancelled.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { textareaClass } from "@/components/bits";

type Field = { name: string; label: string; defaultValue?: string; multiline?: boolean; inputMode?: "decimal" | "numeric" | "text"; required?: boolean };
type Request = { title: string; description?: string; fields: Field[]; confirmLabel?: string; destructive?: boolean };
type Ask = (r: Request) => Promise<Record<string, string> | null>;

const AskContext = createContext<Ask | null>(null);

export function AskProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const resolver = useRef<((v: Record<string, string> | null) => void) | null>(null);
  const ask = useCallback<Ask>((r) => new Promise((resolve) => { resolver.current = resolve; setReq(r); }), []);
  const close = (v: Record<string, string> | null) => { resolver.current?.(v); resolver.current = null; setReq(null); };

  return (
    <AskContext.Provider value={ask}>
      {children}
      <Dialog open={!!req} onOpenChange={(open) => !open && close(null)}>
        {req && (
          <DialogContent>
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); close(Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v).trim()]))); }}>
              <DialogHeader>
                <DialogTitle>{req.title}</DialogTitle>
                {req.description && <DialogDescription>{req.description}</DialogDescription>}
              </DialogHeader>
              {req.fields.map((f, i) => (
                <div key={f.name} className="grid gap-1.5">
                  <label htmlFor={`ask-${f.name}`} className="text-sm font-medium">{f.label}</label>
                  {f.multiline
                    ? <textarea id={`ask-${f.name}`} name={f.name} defaultValue={f.defaultValue} required={f.required !== false} autoFocus={i === 0} className={textareaClass} />
                    : <Input id={`ask-${f.name}`} name={f.name} defaultValue={f.defaultValue} required={f.required !== false} autoFocus={i === 0} inputMode={f.inputMode} />}
                </div>
              ))}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => close(null)}>Cancel</Button>
                <Button type="submit" variant={req.destructive ? "destructive" : "default"}>{req.confirmLabel ?? "OK"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </AskContext.Provider>
  );
}

/** ask({ title, fields }) → values or null; confirm({ title, description }) → boolean. */
export function useAsk() {
  const ask = useContext(AskContext);
  if (!ask) throw new Error("useAsk outside AskProvider");
  const one = (title: string, label: string, extra: Partial<Field> & { description?: string; confirmLabel?: string; destructive?: boolean } = {}) =>
    ask({ title, description: extra.description, confirmLabel: extra.confirmLabel, destructive: extra.destructive, fields: [{ name: "v", label, ...extra }] }).then((r) => r?.v ?? null);
  const confirm = (title: string, description?: string, confirmLabel = "Continue", destructive = false) =>
    ask({ title, description, fields: [], confirmLabel, destructive }).then((r) => r !== null);
  return { ask, one, confirm };
}
