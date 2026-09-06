export interface AssetMetrics {
  symbol: string;
  values: Record<string, number>;
  marketPrice: number; // 0-1 probability for prediction markets; neutral 0.5 placeholder for crypto until calibrated
  raw?: Record<string, unknown>; // original data from baw, kept for display/debugging
}

export interface ScoredAsset extends AssetMetrics {
  z: Record<string, number>;
  composite: number;
  pHat: number;
  kellyFraction: number;
}

export type Weights = Record<string, number>;
