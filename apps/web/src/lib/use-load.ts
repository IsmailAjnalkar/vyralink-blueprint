"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api";

/** Loads data on mount and whenever `key` changes; `reload` re-runs it after a mutation. */
export function useLoad<T>(fn: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key stands for fn's inputs
  const run = useCallback(() => fn().then((d) => { setData(d); setError(null); }, (e) => setError(e instanceof ApiError ? e.message : "Couldn’t load this.")), [key]);
  useEffect(() => { run(); }, [run]);
  return { data, error, reload: run };
}

/** Runs a mutation and reports a message either way. */
export function useAction(after?: () => unknown) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async <T,>(fn: () => Promise<T>, ok?: string | ((r: T) => string)): Promise<T | undefined> => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const r = await fn();
      if (ok) setNotice(typeof ok === "function" ? ok(r) : ok);
      await after?.();
      return r;
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...(e.details ?? [])].join(" ") : "That didn’t work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { run, error, notice, busy };
}
