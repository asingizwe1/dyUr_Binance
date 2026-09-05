// One row of raw metrics for any asset class. Adapters (crypto, bstock,
// prediction) each produce this same shape from different Binance skills,
// so the scoring engine never needs to know which asset class it's scoring.
export interface AssetMetrics {
  symbol: string;
  values: Record<string, number>; // e.g. { volume: 4.2e6, sentiment: 78, smartMoney: 1.3e5 }
  marketPrice: number; // current price, or market-implied probability for prediction markets
}

export interface ScoredAsset extends AssetMetrics {
  z: Record<string, number>;
  composite: number;
  pHat: number; // calibrated probability estimate, derived from composite via sigmoid
  kellyFraction: number;
}

export type Weights = Record<string, number>;
