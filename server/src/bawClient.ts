import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Runs a `baw` CLI command and returns its parsed `data` field.
 *
 * This assumes `baw` is installed and authenticated on this machine
 * (check the Agentic Wallet dev portal for the install/auth steps —
 * that part isn't covered by the skill docs you shared, so verify it
 * separately before relying on this in your demo).
 *
 * Every response follows { success: boolean, data: ... } per
 * market-order.md / prediction.md — we throw on success:false so
 * callers don't have to check it themselves.
 */
export async function baw<T = unknown>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync("baw", [...args, "--json"]);
  const parsed = JSON.parse(stdout) as { success: boolean; data: T };
  if (!parsed.success) {
    throw new Error(`baw ${args.join(" ")} returned success:false — ${stdout}`);
  }
  return parsed.data;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Submits a market-order swap and polls to a terminal state, per the
 * mandatory polling rule in market-order.md — an orderId alone does NOT
 * mean the swap executed.
 */
export async function swapAndConfirm(params: {
  fromTokenQty: string;
  fromToken: string;
  toToken: string;
  binanceChainId: string;
  slippage?: string;
}): Promise<{ orderId: string; status: "FINISHED" | "FAILED" | "PENDING"; txHash?: string | null }> {
  const submitArgs = [
    "market-order",
    "swap",
    "--fromTokenQty",
    params.fromTokenQty,
    "--fromToken",
    params.fromToken,
    "--toToken",
    params.toToken,
    "--binanceChainId",
    params.binanceChainId,
  ];
  if (params.slippage) submitArgs.push("--slippage", params.slippage);

  const { orderId } = await baw<{ orderId: string }>(submitArgs);

  type OrderStatus = "FINISHED" | "FAILED" | "PENDING";
  interface OrderListItem {
    status: OrderStatus;
    txHash?: string | null;
  }

  let status: OrderStatus = "PENDING";
  let txHash: string | null | undefined;
  for (let attempt = 0; attempt < 15 && status === "PENDING"; attempt++) {
    await sleep(2000);
    const list = await baw<{ list: OrderListItem[] }>(["market-order", "list", "--orderId", orderId]);
    const order = list.list[0];
    if (order) {
      status = order.status;
      txHash = order.txHash;
    }
  }

  return { orderId, status, txHash };
}

/** Two-step prediction trade: quote, then (after confirmation) place-order. */
export async function quotePrediction(params: {
  binanceChainId: string;
  tokenId: string;
  marketTopicId: string;
  side: "BUY" | "SELL";
  amount: string;
  orderType?: "MARKET" | "LIMIT";
}) {
  return baw<{
    quoteId: string;
    amountIn: string;
    amountOut: string;
    averagePrice: number;
    slippageBps: number;
    expireAt: string;
  }>([
    "prediction",
    "trade",
    "quote",
    "--binanceChainId",
    params.binanceChainId,
    "--tokenId",
    params.tokenId,
    "--marketTopicId",
    params.marketTopicId,
    "--side",
    params.side,
    "--amount",
    params.amount,
    "--orderType",
    params.orderType ?? "MARKET",
  ]);
}

export async function placePredictionOrder(quoteId: string, slippageBps: number) {
  return baw<{ orderId: string }>([
    "prediction",
    "trade",
    "place-order",
    "--quoteId",
    quoteId,
    "--slippageBps",
    String(slippageBps),
  ]);
}
