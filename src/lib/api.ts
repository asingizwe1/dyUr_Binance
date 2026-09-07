import type { ScoredAsset } from "../types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

export async function scan(assetClass: "crypto" | "prediction" | "bstock", weights?: Record<string, number>): Promise<ScoredAsset[]> {
  const res = await fetch(`${BASE}/api/scan/${assetClass}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weights }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Scan failed: ${res.status}`);
  }
  return res.json();
}

export async function suggestWeights(assetClass: string, description: string): Promise<Record<string, number>> {
  const res = await fetch(`${BASE}/api/suggest-weights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetClass, description }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Suggest weights failed: ${res.status}`);
  }
  return (await res.json()).weights;
}

export async function notify(params: {
  to: string;
  symbol: string;
  composite: number;
  threshold: number;
  kellyFraction: number;
  assetClass: string;
}) {
  const res = await fetch(`${BASE}/api/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Notify failed: ${res.status}`);
  return res.json();
}
