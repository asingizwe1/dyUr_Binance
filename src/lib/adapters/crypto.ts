import type { AssetMetrics } from "../../types";

/**
 * Crypto adapter.
 *
 * Real skill calls this should make (via your MCP client / agent runtime,
 * not from the browser — see README for why the browser can't call these
 * directly):
 *
 *   crypto-market-rank.query({ rankType: "social_hype" })   -> sentiment
 *   crypto-market-rank.query({ rankType: "market_cap" })    -> marketCapRank
 *   trading-signal.smartMoneyFlow({ symbols })               -> smartMoney
 *   query-token-info.volume24h({ symbols })                  -> volume, marketPrice
 *
 * Until those are wired up (server-side), this returns deterministic mock
 * data shaped exactly like the real responses, so the scoring engine and
 * UI can be built and demoed against realistic numbers today.
 */

const CANDIDATES = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "LINKUSDT"];

function seeded(seedStr: string) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return (h % 1000) / 1000;
  };
}

export async function fetchCryptoUniverse(): Promise<AssetMetrics[]> {
  // TODO: replace this block with real calls to the skills listed above.
  return CANDIDATES.map((symbol) => {
    const rnd = seeded(symbol);
    return {
      symbol,
      values: {
        volume: 2e6 + rnd() * 8e6,
        sentiment: 40 + rnd() * 55,
        smartMoney: -0.5e5 + rnd() * 3e5,
      },
      marketPrice: 0.5, // neutral placeholder — see scoring.ts impliedProbability()
    };
  });
}
