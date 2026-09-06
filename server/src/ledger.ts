import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_PATH = path.join(__dirname, "..", "data", "ledger.json");

export type AssetClass = "crypto" | "prediction" | "bstock";

interface Ledger {
  [assetClass: string]: number; // remaining USDT budget for that class
}

/**
 * Since baw's wallet has no sub-account concept, "distribution across
 * crypto / prediction markets / bstocks" is just bookkeeping on our
 * side: one wallet, one balance, and we track how much of it we've
 * earmarked per asset class so we never over-commit. Every Kelly-sized
 * order debits this before calling baw.
 */
function readLedger(): Ledger {
  if (!existsSync(LEDGER_PATH)) {
    const initial: Ledger = { crypto: 0, prediction: 0, bstock: 0 };
    writeFileSync(LEDGER_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(readFileSync(LEDGER_PATH, "utf-8"));
}

function writeLedger(ledger: Ledger) {
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

export function getBudget(assetClass: AssetClass): number {
  return readLedger()[assetClass] ?? 0;
}

export function setBudget(assetClass: AssetClass, amountUsdt: number) {
  const ledger = readLedger();
  ledger[assetClass] = amountUsdt;
  writeLedger(ledger);
}

/** Returns false (and debits nothing) if the amount exceeds the remaining budget. */
export function tryDebit(assetClass: AssetClass, amountUsdt: number): boolean {
  const ledger = readLedger();
  const remaining = ledger[assetClass] ?? 0;
  if (amountUsdt > remaining) return false;
  ledger[assetClass] = remaining - amountUsdt;
  writeLedger(ledger);
  return true;
}
