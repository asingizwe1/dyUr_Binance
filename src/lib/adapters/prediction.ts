import type { AssetMetrics } from "../../types";

/**
 * Prediction market adapter.
 *
 * Real skill calls (via binance-agentic-wallet's prediction.md):
 *   - list open markets, current share price (this IS the market-implied
 *     probability — pass it straight into AssetMetrics.marketPrice)
 *   - volume / open interest per market
 *   - recent probability shift (momentum equivalent)
 *
 * Same scoring.ts and kelly() functions as crypto — only this adapter
 * differs. Stubbed for now; wire up once the crypto path is proven end to end.
 */
export async function fetchPredictionUniverse(): Promise<AssetMetrics[]> {
  return [
    {
      symbol: "WILL-BTC-100K-EOY",
      values: { volume: 1.2e5, probShift: 0.08, openInterestChange: 0.22 },
      marketPrice: 0.62, // real market-implied probability once wired up
    },
  ];
}
