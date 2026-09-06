import { baw } from "../bawClient.js";
import type { AssetMetrics } from "../types.js";

interface MarketListItem {
  marketTopicId: string;
  marketId?: string;
  marketTitle: string;
  volume?: number;
  participants?: number;
  tokenId?: string; // outcome token to trade — verify exact field name against real output
}

/**
 * NOTE on field names: prediction.md documents `market list`'s parameters
 * but not its full response schema. The field names below (volume,
 * participants, tokenId) are reasonable guesses based on the sort options
 * (VOLUME, PARTICIPANTS) — run `baw prediction market list --json` once
 * for real and adjust these to match the actual keys before demo night.
 */
export async function fetchPredictionUniverse(): Promise<AssetMetrics[]> {
  const { list } = await baw<{ list: MarketListItem[] }>([
    "prediction",
    "market",
    "list",
    "--sortBy",
    "VOLUME",
    "--limit",
    "10",
  ]);

  const rows: AssetMetrics[] = [];
  for (const market of list) {
    if (!market.marketId) continue;
    // last-trade-price is a historical fill, not a live quote (per prediction.md) —
    // fine for scoring/ranking, but re-quote via `prediction trade quote` right
    // before actually executing, since this can be stale.
    const priceData = await baw<{ price: number }>([
      "prediction",
      "market",
      "last-trade-price",
      "--marketId",
      market.marketId,
    ]).catch(() => ({ price: 0.5 })); // no recent trades — neutral fallback

    rows.push({
      symbol: market.marketTitle,
      values: {
        volume: market.volume ?? 0,
        participants: market.participants ?? 0,
      },
      marketPrice: priceData.price,
      raw: { marketTopicId: market.marketTopicId, marketId: market.marketId, tokenId: market.tokenId },
    });
  }
  return rows;
}
