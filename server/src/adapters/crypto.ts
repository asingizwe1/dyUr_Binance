import type { AssetMetrics } from "../types.js";

/**
 * UNVERIFIED — you've only shared market-order.md and prediction.md so
 * far, both of which use `baw <command> <subcommand> --json`. This
 * adapter assumes crypto-market-rank / trading-signal / query-token-info
 * follow the same CLI pattern, but I don't have their actual SKILL.md,
 * so the command names and flags below are guesses shaped to look
 * consistent with the two real docs — NOT confirmed syntax.
 *
 * Upload those three SKILL.md files (same way you did prediction.md and
 * market-order.md) and this file gets corrected exactly like the
 * prediction adapter was — real field names, real command syntax, no
 * more guessing.
 */
const CANDIDATES = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "LINKUSDT"];

export async function fetchCryptoUniverse(): Promise<AssetMetrics[]> {
  // TODO: replace with real calls once the skill docs are confirmed, e.g.:
  //   const hype = await baw(["crypto-market-rank", "query", "--rankType", "social_hype"]);
  //   const smartMoney = await baw(["trading-signal", "smart-money-flow", "--symbols", ...]);
  //   const volume = await baw(["query-token-info", "volume24h", "--symbols", ...]);
  // Until then, deterministic mock data so scoring/UI/demo can be built and
  // rehearsed today without blocking on the real integration.
  return CANDIDATES.map((symbol) => {
    const rnd = seeded(symbol);
    return {
      symbol,
      values: {
        volume: 2e6 + rnd() * 8e6,
        sentiment: 40 + rnd() * 55,
        smartMoney: -0.5e5 + rnd() * 3e5,
      },
      marketPrice: 0.5,
    };
  });
}

function seeded(seedStr: string) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return (h % 1000) / 1000;
  };
}
