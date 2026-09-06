import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AssetMetrics } from "../types.js";

const execFileAsync = promisify(execFile);

const SKILL_DIR = process.env.CRYPTO_MARKET_RANK_SKILL_DIR ?? "../.agents/skills/crypto-market-rank";
interface SkillResponse<T> {
  code: string;
  message: string | null;
  data: T;
  success: boolean;
}

async function callSkill<T = unknown>(command: string, body: Record<string, unknown>): Promise<T> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("node", [`${SKILL_DIR}/scripts/cli.mjs`, command, JSON.stringify(body)]));
  } catch (err: any) {
    // Network failure or HTTP >= 400 — the script exits non-zero, execFile rejects,
    // and the real reason is in err.stdout/err.stderr per cli.md's error section.
    throw new Error(`crypto-market-rank ${command} failed (exit ${err?.code}): ${err?.stderr || err?.stdout || err.message}`);
  }
  const parsed = JSON.parse(stdout) as SkillResponse<T>;
  if (parsed.code !== "000000") {
    throw new Error(`crypto-market-rank ${command} returned code ${parsed.code}: ${parsed.message}`);
  }
  return parsed.data;
}

// Confirmed against a real response.
interface TokenRankItem {
  contractAddress: string;
  symbol: string;
  price: string;
  marketCap: string;
  volume24h: string;
  smartMoneyHoldingPercent: number | null; // already a number, not string — no conversion needed
}

// NOT independently confirmed — still per cli.md's documented shape.
// If sentiment ends up wrong/empty, this is the interface to check first.
interface SocialHypeEntry {
  metaInfo: { contractAddress: string; symbol: string };
  socialHypeInfo: { socialHype: number; sentiment: string };
}

const CHAIN_ID = "56"; // BSC

export async function fetchCryptoUniverse(): Promise<AssetMetrics[]> {
  const [trending, hype] = await Promise.all([
    callSkill<{ tokens: TokenRankItem[] }>("token-rank", { rankType: 10, chainId: CHAIN_ID, page: 1, size: 20 }),
    callSkill<{ leaderBoardList: SocialHypeEntry[] }>("social-hype", { chainId: CHAIN_ID, targetLanguage: "en", timeRange: 1 }),
  ]);

  const norm = (addr: string) => addr.toLowerCase();
  const hypeByAddr = new Map(hype.leaderBoardList.map((h) => [norm(h.metaInfo.contractAddress), h.socialHypeInfo.socialHype]));
  const hypeValues = [...hypeByAddr.values()];
  const meanHype = hypeValues.length ? hypeValues.reduce((a, b) => a + b, 0) / hypeValues.length : 0;

  return trending.tokens.map((t) => ({
    symbol: t.symbol,
    values: {
      volume: Number(t.volume24h ?? 0),
      sentiment: hypeByAddr.get(norm(t.contractAddress)) ?? meanHype, // neutral, not punishing
      smartMoney: t.smartMoneyHoldingPercent ?? 0,
    },
    marketPrice: 0.5,
    raw: { price: t.price, marketCap: t.marketCap },
  }));
}

/** Tokenized stocks — same skill, rankType 40 instead of 10. */
export async function fetchStockUniverse(): Promise<AssetMetrics[]> {
  const stocks = await callSkill<{ tokens: TokenRankItem[] }>("token-rank", {
    rankType: 40,
    chainId: CHAIN_ID,
    page: 1,
    size: 20,
  });

  return stocks.tokens.map((s) => ({
    symbol: s.symbol,
    values: {
      volume: Number(s.volume24h ?? 0),
      marketCap: Number(s.marketCap ?? 0),
    },
    marketPrice: 0.5,
    raw: { price: s.price },
  }));
}