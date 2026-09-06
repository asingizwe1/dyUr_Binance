import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AssetMetrics } from "../types.js";

const execFileAsync = promisify(execFile);

// Wherever `npx skills add .../crypto-market-rank` installed it for your
// agent — check your actual install (e.g. .claude/skills/crypto-market-rank)
// and point this at the real path, or set it via env var.
const SKILL_DIR = process.env.CRYPTO_MARKET_RANK_SKILL_DIR ?? "./.claude/skills/crypto-market-rank";

async function callSkill<T = unknown>(command: string, body: Record<string, unknown>): Promise<T> {
  const { stdout } = await execFileAsync("node", [`${SKILL_DIR}/scripts/cli.mjs`, command, JSON.stringify(body)]);
  return JSON.parse(stdout) as T;
}

interface TokenRankItem {
  symbol: string;
  price: string; // numeric fields arrive as strings per the skill's rules — convert before arithmetic
  volume?: string;
  marketCap?: string;
}

interface SocialHypeItem {
  symbol: string;
  hypeScore: number; // field name unconfirmed — verify against real output
}

interface SmartMoneyItem {
  symbol: string;
  netInflow: number; // field name unconfirmed — verify against real output
}

const CHAIN_ID = "56"; // BSC

export async function fetchCryptoUniverse(): Promise<AssetMetrics[]> {
  const [trending, hype, smartMoney] = await Promise.all([
    callSkill<{ list: TokenRankItem[] }>("token-rank", { rankType: 10, chainId: CHAIN_ID, page: 1, size: 20 }),
    callSkill<{ list: SocialHypeItem[] }>("social-hype", { chainId: CHAIN_ID, targetLanguage: "en", timeRange: 1 }),
    callSkill<{ list: SmartMoneyItem[] }>("smart-money-inflow", { chainId: CHAIN_ID, period: "24h" }),
  ]);

  const hypeBySymbol = new Map(hype.list.map((h) => [h.symbol, h.hypeScore]));
  const smartMoneyBySymbol = new Map(smartMoney.list.map((s) => [s.symbol, s.netInflow]));

  return trending.list.map((t) => ({
    symbol: t.symbol,
    values: {
      volume: Number(t.volume ?? 0),
      sentiment: hypeBySymbol.get(t.symbol) ?? 0,
      smartMoney: smartMoneyBySymbol.get(t.symbol) ?? 0,
    },
    marketPrice: 0.5,
    raw: { price: t.price, marketCap: t.marketCap },
  }));
}

/** Tokenized stocks — same skill, rankType 40 instead of 10. */
export async function fetchStockUniverse(): Promise<AssetMetrics[]> {
  const stocks = await callSkill<{ list: TokenRankItem[] }>("token-rank", {
    rankType: 40,
    chainId: CHAIN_ID,
    page: 1,
    size: 20,
  });

  return stocks.list.map((s) => ({
    symbol: s.symbol,
    values: {
      volume: Number(s.volume ?? 0),
      marketCap: Number(s.marketCap ?? 0),
    },
    marketPrice: 0.5,
    raw: { price: s.price },
  }));
}
