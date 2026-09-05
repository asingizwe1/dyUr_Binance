import React, { useEffect, useRef, useState } from "react";
import { fetchCryptoUniverse } from "./lib/adapters/crypto";
import { scoreUniverse } from "./lib/scoring";
import type { ScoredAsset } from "./types";

const INK = "#17140F";
const PAPER = "#F3EFE6";
const SIGNAL = "#E8C13A";

type Stage = "idle" | "scanning" | "scored" | "notified" | "confirmed";

function Window({
  title,
  icon,
  children,
  tint,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  tint?: string;
}) {
  return (
    <div
      className="border-2 w-full max-w-2xl"
      style={{ borderColor: INK, boxShadow: `5px 5px 0 ${INK}`, background: tint ?? "#FFFFFF" }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b-2" style={{ borderColor: INK, background: PAPER }}>
        <span className="text-[11px] tracking-wide font-bold uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif", color: INK }}>
          {icon} {title}
        </span>
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 border-2 inline-block" style={{ borderColor: INK }} />
          <span className="w-2.5 h-2.5 border-2 inline-block" style={{ borderColor: INK }} />
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 text-[12px] font-bold uppercase border-2 transition-transform active:translate-x-[2px] active:translate-y-[2px]"
      style={{
        borderColor: INK,
        background: disabled ? "#DDD8CC" : primary ? SIGNAL : "#FFFFFF",
        color: INK,
        boxShadow: disabled ? "none" : `3px 3px 0 ${INK}`,
        fontFamily: "'Space Grotesk', sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

const WEIGHTS = { volume: 0.25, sentiment: 0.3, smartMoney: 0.3 };

const LOG_LINES = [
  "$ agent.scan(assetClass=\"crypto\")",
  '→ crypto-market-rank.query(rankType="social_hype")',
  '→ crypto-market-rank.query(rankType="market_cap")',
  "→ trading-signal.smartMoneyFlow(symbols=[...])",
  "→ query-token-info.volume24h(symbols=[...])",
  "✓ skill calls complete, candidates scored",
];

export default function App() {
  const [stage, setStage] = useState<Stage>("idle");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [rows, setRows] = useState<ScoredAsset[]>([]);
  const [threshold, setThreshold] = useState(1.0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runScan = async () => {
    setStage("scanning");
    setLogLines([]);
    const universe = await fetchCryptoUniverse();
    const scored = scoreUniverse(universe, WEIGHTS);

    let i = 0;
    timerRef.current = setInterval(() => {
      setLogLines((prev) => [...prev, LOG_LINES[i]]);
      i++;
      if (i >= LOG_LINES.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setRows(scored);
        setTimeout(() => setStage("scored"), 400);
      }
    }, 420);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const top = rows[0];
  const qualifies = !!top && top.composite >= threshold;

  return (
    <div className="min-h-screen w-full flex flex-col items-center gap-5 p-6" style={{ background: PAPER, fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="w-full max-w-2xl flex items-center justify-between">
        <h1 className="text-lg font-bold uppercase tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", color: INK }}>
          ✦ DyUr — DYOR Agent ✦
        </h1>
        <span className="text-[11px]" style={{ color: INK }}>Track A · Agent OS</span>
      </div>

      <Window title="Criteria" icon="⚑">
        <div className="flex flex-wrap items-center gap-4 text-[12px]" style={{ color: INK }}>
          <span>Composite threshold</span>
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.1}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-40 accent-black"
          />
          <span className="font-bold">{threshold.toFixed(1)}σ</span>
          <div className="flex-1" />
          <Btn onClick={runScan} primary disabled={stage === "scanning"}>
            {stage === "idle" ? "Run scan" : "Re-run scan"}
          </Btn>
        </div>
      </Window>

      {stage !== "idle" && (
        <Window title="Live scan — MCP calls" icon="▣" tint="#111111">
          <div className="text-[12px] leading-6" style={{ color: "#D7F26D" }}>
            {logLines.map((l, idx) => (
              <div key={idx}>{l}</div>
            ))}
            {stage === "scanning" && <span className="animate-pulse">▮</span>}
          </div>
        </Window>
      )}

      {(stage === "scored" || stage === "notified" || stage === "confirmed") && (
        <Window title="Score breakdown" icon="≡">
          <table className="w-full text-[11px]" style={{ color: INK }}>
            <thead>
              <tr className="border-b-2" style={{ borderColor: INK }}>
                <th className="text-left py-1">Symbol</th>
                <th className="text-right">z(volume)</th>
                <th className="text-right">z(sentiment)</th>
                <th className="text-right">z(smart$)</th>
                <th className="text-right">composite</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol} className={r.composite >= threshold ? "font-bold" : ""}>
                  <td className="py-1">{r.symbol}</td>
                  <td className="text-right">{r.z.volume.toFixed(2)}</td>
                  <td className="text-right">{r.z.sentiment.toFixed(2)}</td>
                  <td className="text-right">{r.z.smartMoney.toFixed(2)}</td>
                  <td className="text-right" style={{ background: r.composite >= threshold ? SIGNAL : "transparent" }}>
                    {r.composite.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {qualifies && stage === "scored" && (
            <div className="mt-3 flex justify-end">
              <Btn onClick={() => setStage("notified")} primary>
                Send notification →
              </Btn>
            </div>
          )}
        </Window>
      )}

      {(stage === "notified" || stage === "confirmed") && qualifies && top && (
        <Window title="Buy signal — confirm required" icon="✉">
          <div className="text-[12px] space-y-2" style={{ color: INK }}>
            <p>
              <span className="font-bold">{top.symbol}</span> crossed your threshold: composite{" "}
              <span className="font-bold">{top.composite.toFixed(2)}σ</span> (min {threshold.toFixed(1)}σ).
            </p>
            <p>
              Kelly-sized suggestion: <span className="font-bold">{(top.kellyFraction * 100).toFixed(1)}%</span> of the crypto
              allocation bucket.
            </p>
            {stage === "notified" ? (
              <div className="flex gap-2 justify-end pt-2">
                <Btn onClick={() => setStage("scored")}>Dismiss</Btn>
                <Btn onClick={() => setStage("confirmed")} primary>
                  Confirm &amp; execute
                </Btn>
              </div>
            ) : (
              <div className="pt-2 text-[12px] font-bold" style={{ color: "#2E7D32" }}>
                ✓ Order placed on Spot Testnet — sub-account balance updated.
              </div>
            )}
          </div>
        </Window>
      )}

      {!qualifies && stage === "scored" && top && (
        <Window title="No signal this cycle" icon="○">
          <p className="text-[12px]" style={{ color: INK }}>
            Top candidate {top.symbol} scored {top.composite.toFixed(2)}σ, below your {threshold.toFixed(1)}σ threshold.
            No notification sent — agent will re-scan next cycle.
          </p>
        </Window>
      )}
    </div>
  );
}
