import type { ScoredAsset } from "../types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

export async function scan(assetClass: "crypto" | "prediction" | "bstock"): Promise<ScoredAsset[]> {
  const res = await fetch(`${BASE}/api/scan/${assetClass}`);
  if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
  return res.json();
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
