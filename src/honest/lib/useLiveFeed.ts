import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHonestStore } from "./store";
import { useFeedStatus } from "./feedStatus";

const FRESHNESS_MAX_MS = 30_000;
const DUPLICATE_WINDOW_MS = 6_000;

let lastAcceptedNumber: number | null = null;
let lastAcceptedAt = 0;

const accept = (n: number): boolean => {
  const now = Date.now();
  if (n === lastAcceptedNumber && now - lastAcceptedAt < DUPLICATE_WINDOW_MS) return false;
  lastAcceptedNumber = n;
  lastAcceptedAt = now;
  return true;
};

const numberFromUnknown = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseInt(v, 10) : (v as number);
  if (typeof n !== "number" || isNaN(n) || n < 0 || n > 36) return null;
  return n;
};

interface ProxyResponse {
  results?: unknown[];
  numbers?: unknown[];
  mesa?: string;
  table?: string;
  data?: { results?: unknown[]; numbers?: unknown[]; mesa?: string };
}

const extractNumbers = (data: ProxyResponse | null | undefined): number[] => {
  if (!data) return [];
  const arr = data.results || data.numbers || data.data?.results || data.data?.numbers || [];
  if (!Array.isArray(arr)) return [];
  return arr.map(numberFromUnknown).filter((n): n is number => n !== null);
};

const extractMesa = (data: ProxyResponse | null | undefined): string | null => {
  if (!data) return null;
  return (data.mesa || data.table || data.data?.mesa || null) as string | null;
};

const UPSTREAM_URL = "https://www.iamonstro.com.br/apicurso/roleta.php";

const fetchUpstreamDirect = async (): Promise<{ data: ProxyResponse | null; source: string } | null> => {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(UPSTREAM_URL, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as ProxyResponse;
    return { data, source: "iamonstro (direto)" };
  } catch {
    return null;
  }
};

const fetchViaSupabaseProxy = async (): Promise<{ data: ProxyResponse | null; source: string } | null> => {
  try {
    const res = await supabase.functions.invoke<ProxyResponse>("proxy-roleta");
    if (res.error || !res.data) return null;
    return { data: res.data, source: "supabase-proxy" };
  } catch {
    return null;
  }
};

let lastFreshHead: number | null = null;
let lastFreshLen = 0;
let consecutiveErrors = 0;
let backoffUntil = 0;

export const ingestProxyNumbers = async (): Promise<number> => {
  const feed = useFeedStatus.getState();
  if (Date.now() < backoffUntil) {
    feed.setError(`Backoff: aguardando ${Math.ceil((backoffUntil - Date.now()) / 1000)}s pra retomar`);
    return 0;
  }
  try {
    let result = await fetchUpstreamDirect();
    if (!result) result = await fetchViaSupabaseProxy();
    if (!result) {
      consecutiveErrors += 1;
      const backoffSec = Math.min(60, Math.pow(2, consecutiveErrors));
      backoffUntil = Date.now() + backoffSec * 1000;
      feed.setError(`Nenhuma fonte respondeu. Backoff ${backoffSec}s (tentativa ${consecutiveErrors})`);
      return 0;
    }
    consecutiveErrors = 0;
    backoffUntil = 0;
    const fresh = extractNumbers(result.data);
    const mesa = extractMesa(result.data) ?? "Roleta Brasileira";
    if (fresh.length === 0) {
      feed.pollOk(`${result.source} (vazio)`, 0, mesa);
      return 0;
    }

    const headChanged = lastFreshHead !== fresh[0] || lastFreshLen !== fresh.length;
    if (!headChanged && lastFreshHead !== null) {
      feed.pollOk(`${result.source} (sem mudança)`, 0, mesa);
      return 0;
    }

    const newCount = lastFreshHead === null ? fresh.length : Math.max(1, fresh.length - lastFreshLen + 1);
    lastFreshHead = fresh[0];
    lastFreshLen = fresh.length;

    useHonestStore.getState().setLiveSpins(fresh);

    feed.pollOk(result.source, newCount, mesa);
    return newCount;
  } catch (err) {
    consecutiveErrors += 1;
    const backoffSec = Math.min(60, Math.pow(2, consecutiveErrors));
    backoffUntil = Date.now() + backoffSec * 1000;
    feed.setError(err instanceof Error ? `${err.message} · backoff ${backoffSec}s` : String(err));
    return 0;
  }
};

export const useLiveFeed = (enabled: boolean = true) => {
  const addSpin = useHonestStore((s) => s.addSpin);
  const touch = useFeedStatus((s) => s.touch);
  const setStatus = useFeedStatus((s) => s.setStatus);
  const setError = useFeedStatus((s) => s.setError);
  const pollEnabled = useFeedStatus((s) => s.pollEnabled);
  const pollInterval = useFeedStatus((s) => s.pollInterval);

  const ingestFromProxy = useCallback(() => ingestProxyNumbers(), []);

  useEffect(() => {
    if (!enabled) return;
    setStatus("connecting");
    ingestProxyNumbers().catch(() => undefined);
  }, [enabled, setStatus]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: MessageEvent) => {
      const d = event.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "NUMBER_FROM_EXTENSION") {
        const n = numberFromUnknown(d.number);
        if (n !== null && accept(n)) {
          addSpin(n, "extension");
          touch("extension");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [enabled, addSpin, touch]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`honest_spin_feed_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "roulette_numbers" },
        (payload: { new?: { number?: unknown; fetched_at?: string } }) => {
          const row = payload?.new;
          if (!row) return;
          const n = numberFromUnknown(row.number);
          if (n === null) return;
          const ts = row.fetched_at ? new Date(row.fetched_at).getTime() : Date.now();
          if (Date.now() - ts > FRESHNESS_MAX_MS) return;
          if (accept(n)) {
            addSpin(n, "live");
            touch("supabase-realtime");
          }
        }
      )
      .subscribe();

    const channel2 = supabase
      .channel(`honest_spin_feed_alt_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "resultados_roleta" },
        (payload: { new?: { numero?: unknown; created_at?: string } }) => {
          const row = payload?.new;
          const n = numberFromUnknown(row?.numero);
          if (n === null) return;
          const ts = row?.created_at ? new Date(row.created_at).getTime() : Date.now();
          if (Date.now() - ts > FRESHNESS_MAX_MS) return;
          if (accept(n)) {
            addSpin(n, "live");
            touch("supabase-realtime-alt");
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
        supabase.removeChannel(channel2);
      } catch {
        /* noop */
      }
    };
  }, [enabled, addSpin, touch]);

  useEffect(() => {
    if (!enabled || !pollEnabled) return;
    ingestFromProxy();
    const id = setInterval(ingestFromProxy, pollInterval);
    return () => clearInterval(id);
  }, [enabled, pollEnabled, pollInterval, ingestFromProxy]);

  return { refreshNow: ingestFromProxy };
};
