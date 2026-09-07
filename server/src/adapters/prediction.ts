import { baw } from "../bawClient.js";
import type { AssetMetrics } from "../types.js";

// Confirmed against a real response — two levels of nesting, not flat.
interface Outcome {
  name: string; // "Yes" / "No"
  price: number; // 0-1, this IS the market-implied probability
  tokenId: string;
}

interface Market {
  marketId: number;
  title: string;
  tradeVolume: number;
  liquidity: number;
  outcomes: Outcome[];
}

interface MarketTopic {
  marketTopicId: number;
  title: string;
  participantCount: number;
  markets: Market[];
}

export async function fetchPredictionUniverse(): Promise<AssetMetrics[]> {
  const { marketTopics } = await baw<{ marketTopics: MarketTopic[] }>([
    "prediction",
    "market",
    "list",
    "--sortBy",
    "VOLUME",
    "--limit",
    "10",
  ]);

  const rows: AssetMetrics[] = [];
  for (const topic of marketTopics) {
    for (const market of topic.markets) {
      const yes = market.outcomes.find((o) => o.name === "Yes");
      if (!yes) continue; // skip non-binary markets for now

      rows.push({
        symbol: `${topic.title} — ${market.title}`,
        values: {
          volume: market.tradeVolume,
          participants: topic.participantCount,
        },
        marketPrice: yes.price, // already the live implied probability
        raw: { marketId: market.marketId, tokenId: yes.tokenId, marketTopicId: topic.marketTopicId },
      });
    }
  }
  return rows;
}