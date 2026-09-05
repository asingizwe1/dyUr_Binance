import type { AssetMetrics, ScoredAsset, Weights } from "../types";

/**
 * Composite scoring via z-score normalization.
 *
 * Turns unrelated-unit metrics (volume in dollars, sentiment 0-100,
 * smart-money flow in dollars, probability shift in %) into one
 * comparable number per asset, by measuring each metric's distance
 * from the mean of the current scan universe in standard deviations,
 * then combining them with user-set weights.
 *
 * This function is asset-class agnostic: it only ever sees `values`
 * (a plain metric-name -> number map) and doesn't know or care whether
 * it's scoring a crypto pair, a tokenized stock, or a prediction market.
 * Each asset class's differences live in the adapter that produces
 * `AssetMetrics`, not here.
 */
export function scoreUniverse(assets: AssetMetrics[], weights: Weights): ScoredAsset[] {
  const keys = Object.keys(weights);

  const stats: Record<string, { mean: number; std: number }> = {};
  for (const key of keys) {
    const vals = assets.map((a) => a.values[key] ?? 0);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    stats[key] = { mean, std: Math.sqrt(variance) || 1 };
  }

  return assets
    .map((asset) => {
      const z: Record<string, number> = {};
      let composite = 0;
      for (const key of keys) {
        const raw = asset.values[key] ?? 0;
        const zScore = (raw - stats[key].mean) / stats[key].std;
        z[key] = zScore;
        composite += zScore * weights[key];
      }

      // Sigmoid maps the unbounded composite z-score onto a 0-1
      // probability estimate (p_hat), so the same Kelly function below
      // can be reused across every asset class.
      const pHat = 1 / (1 + Math.exp(-composite));

      const kellyFraction = kelly(pHat, impliedProbability(asset.marketPrice));

      return { ...asset, z, composite, pHat, kellyFraction };
    })
    .sort((a, b) => b.composite - a.composite);
}

/**
 * Kelly Criterion, capped to avoid over-betting on estimation error
 * (real funds use fractional/capped Kelly, never full Kelly).
 *
 * f* = (p_hat - marketImpliedProbability) / (1 - marketImpliedProbability)
 *
 * For prediction markets, marketImpliedProbability IS the share price —
 * this is the cleanest application of the formula. For crypto/bstocks,
 * we approximate it from recent price action in the adapter (see
 * adapters/crypto.ts) so the same function still applies.
 */
export function kelly(pHat: number, marketImpliedProbability: number, cap = 0.25): number {
  const edge = pHat - marketImpliedProbability;
  if (edge <= 0) return 0;
  const f = edge / (1 - marketImpliedProbability);
  return Math.min(f, cap);
}

// Placeholder mapping from a raw market price to an implied probability.
// For prediction markets, pass the actual share price (already 0-1) in
// AssetMetrics.marketPrice via the prediction adapter. For crypto/bstocks,
// replace this with your own calibration (e.g. based on recent volatility
// or a simple 50/50 baseline) — 0.5 is a neutral placeholder for now.
function impliedProbability(marketPrice: number): number {
  if (marketPrice > 0 && marketPrice < 1) return marketPrice; // already a probability (prediction markets)
  return 0.5; // neutral baseline for crypto/bstocks until you calibrate this
}
