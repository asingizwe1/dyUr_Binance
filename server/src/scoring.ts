import type { AssetMetrics, ScoredAsset, Weights } from "./types.js";

/**
 * Same engine as src/lib/scoring.ts on the frontend. Kept as a plain,
 * dependency-free copy here (rather than importing across the two
 * separate npm projects) so the server can run standalone — if you
 * turn this into a monorepo later, extract both copies into one
 * shared package instead of keeping them in sync by hand.
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
      const pHat = 1 / (1 + Math.exp(-composite));
      const impliedProbability = asset.marketPrice > 0 && asset.marketPrice < 1 ? asset.marketPrice : 0.5;
      const kellyFraction = kelly(pHat, impliedProbability);
      return { ...asset, z, composite, pHat, kellyFraction };
    })
    .sort((a, b) => b.composite - a.composite);
}

export function kelly(pHat: number, marketImpliedProbability: number, cap = 0.25): number {
  const edge = pHat - marketImpliedProbability;
  if (edge <= 0) return 0;
  const f = edge / (1 - marketImpliedProbability);
  return Math.min(f, cap);
}
