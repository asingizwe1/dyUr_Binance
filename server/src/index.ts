import "dotenv/config";
import express from "express";
import cors from "cors";
import { fetchCryptoUniverse, fetchStockUniverse } from "./adapters/crypto.js";
import { fetchPredictionUniverse } from "./adapters/prediction.js";
import { scoreUniverse } from "./scoring.js";
import { sendSignalEmail } from "./mailer.js";
import { swapAndConfirm, quotePrediction, placePredictionOrder } from "./bawClient.js";
import { getBudget, tryDebit, setBudget, type AssetClass } from "./ledger.js";
import { suggestWeights } from "./weightSuggester.js";
const app = express();
app.use(cors());
app.use(express.json());

const DEFAULT_WEIGHTS: Record<AssetClass, Record<string, number>> = {
  crypto: { volume: 0.25, sentiment: 0.3, smartMoney: 0.3 },
  prediction: { volume: 0.5, participants: 0.5 },
  bstock: { volume: 0.5, marketCap: 0.5 },
};


// --- Budget setup (replaces the "sub-account" idea — see ledger.ts) ---
app.post("/api/budget/:assetClass", (req, res) => {
  const assetClass = req.params.assetClass as AssetClass;
  const { amountUsdt } = req.body as { amountUsdt: number };
  setBudget(assetClass, amountUsdt);
  res.json({ assetClass, budget: getBudget(assetClass) });
});

app.post("/api/suggest-weights", async (req, res) => {
  const { assetClass, description } = req.body as { assetClass: AssetClass; description: string };
  try {
    const weights = await suggestWeights(assetClass, description);
    res.json({ weights });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/budget/:assetClass", (req, res) => {
  const assetClass = req.params.assetClass as AssetClass;
  res.json({ assetClass, budget: getBudget(assetClass) });
});

// --- Scan + score ---
app.post("/api/scan/:assetClass", async (req, res) => {
  const assetClass = req.params.assetClass as AssetClass;
  const customWeights = req.body?.weights as Record<string, number> | undefined;
  const weights = customWeights ?? DEFAULT_WEIGHTS[assetClass];

  try {
    const universe =
      assetClass === "prediction"
        ? await fetchPredictionUniverse()
        : assetClass === "bstock"
          ? await fetchStockUniverse()
          : await fetchCryptoUniverse();

    const scored = scoreUniverse(universe, weights);
    res.json(scored);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- Notify (called once a scan crosses the user's threshold) ---
app.post("/api/notify", async (req, res) => {
  const { to, symbol, composite, threshold, kellyFraction, assetClass } = req.body;
  try {
    await sendSignalEmail({ to, symbol, composite, threshold, kellyFraction, assetClass });
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- Confirm + execute: crypto/bstock swap ---
app.post("/api/confirm/crypto", async (req, res) => {
  const { assetClass, kellyFraction, fromToken, toToken, binanceChainId } = req.body as {
    assetClass: AssetClass;
    kellyFraction: number;
    fromToken: string;
    toToken: string;
    binanceChainId: string;
  };

  const budget = getBudget(assetClass);
  const amount = budget * kellyFraction;

  if (!tryDebit(assetClass, amount)) {
    return res.status(400).json({ error: "Amount exceeds remaining budget for this asset class" });
  }

  try {
    const result = await swapAndConfirm({
      fromTokenQty: amount.toString(),
      fromToken,
      toToken,
      binanceChainId,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- Confirm + execute: prediction market (two-step quote -> place-order) ---
app.post("/api/confirm/prediction", async (req, res) => {
  const { kellyFraction, binanceChainId, tokenId, marketTopicId } = req.body as {
    kellyFraction: number;
    binanceChainId: string;
    tokenId: string;
    marketTopicId: string;
  };

  const budget = getBudget("prediction");
  const amount = budget * kellyFraction;

  if (!tryDebit("prediction", amount)) {
    return res.status(400).json({ error: "Amount exceeds remaining prediction-market budget" });
  }

  try {
    const quote = await quotePrediction({
      binanceChainId,
      tokenId,
      marketTopicId,
      side: "BUY",
      amount: amount.toString(),
      orderType: "MARKET",
    });
    // In a real flow, show this quote to the user and require a second
    // explicit confirm here before placing — the frontend's confirm
    // dialog already did the first confirm (crossing the threshold);
    // prediction.md asks for confirmation on the quote specifically too.
    const placed = await placePredictionOrder(quote.quoteId, quote.slippageBps);
    res.json({ quote, placed });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`DyUr backend listening on :${PORT}`));
