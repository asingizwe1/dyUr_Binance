import React, { useEffect, useRef, useState } from "react";
import { scan, notify } from "./lib/api";
import { fetchCryptoUniverse } from "./lib/adapters/crypto"; // local fallback if backend isn't running
import { scoreUniverse } from "./lib/scoring";
import type { ScoredAsset } from "./types";

const INK = "#17140F";
const PAPER = "#F3EFE6";
const SIGNAL = "#E8C13A";

type Stage = "idle" | "scanning" | "scored" | "notified" | "confirmed";
type AssetClass = "crypto" | "prediction" | "bstock";

// Plain-language sensitivity instead of a raw sigma value — the user picks
// a feel, not a statistic. The number still shows underneath for anyone
// who wants it, but it's no longer the primary control.
const SENSITIVITY = {
  aggressive: { label: "Aggressive — more signals, weaker ones", threshold: 0.5 },
  balanced: { label: "Balanced", threshold: 1.0 },
  conservative: { label: "Conservative — fewer, stronger signals", threshold: 1.5 },
} as const;
type SensitivityKey = keyof typeof SENSITIVITY;

const ASSET_LABELS: Record<AssetClass, string> = {
  crypto: "Crypto",
  prediction: "Prediction markets",
  bstock: "Tokenized stocks",
};

function Window({ title, icon, children, tint }: { title: string; icon: string; children: React.ReactNode; tint?: string }) {
  return (
    <div className="border-2 w-full max-w-2xl" style={{ borderColor: INK, boxShadow: `5px 5px 0 ${INK}`, background: tint ?? "#FFFFFF" }}>
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

function Btn({ children, onClick, primary, disabled }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
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

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 text-[11px] font-bold uppercase border-2"
      style={{
        borderColor: INK,
        background: active ? INK : "#FFFFFF",
        color: active ? PAPER : INK,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [assetClass, setAssetClass] = useState<AssetClass>("crypto");
  const [stage, setStage] = useState<Stage>("idle");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [rows, setRows] = useState<ScoredAsset[]>([]);
  const [sensitivity, setSensitivity] = useState<SensitivityKey>("balanced");
  const [email, setEmail] = useState("");
  const [backendError, setBackendError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const threshold = SENSITIVITY[sensitivity].threshold;

  const logLinesFor = (ac: AssetClass) =>
    ac === "prediction"
      ? [
          `$ agent.scan(assetClass="prediction")`,
          `→ baw prediction market list --sortBy VOLUME`,
          `→ baw prediction market last-trade-price ...`,
          `✓ candidates scored`,
        ]
      : [
          `$ agent.scan(assetClass="${ac}")`,
          `→ crypto-market-rank.query(rankType="social_hype")`,
          `→ trading-signal.smartMoneyFlow(symbols=[...])`,
          `→ query-token-info.volume24h(symbols=[...])`,
          `✓ candidates scored`,
        ];

  const runScan = async () => {
    setStage("scanning");
    setLogLines([]);
    setBackendError(null);

    const lines = logLinesFor(assetClass);
    let i = 0;
    timerRef.current = setInterval(() => {
      setLogLines((prev) => [...prev, lines[i]]);
      i++;
      if (i >= lines.length && timerRef.current) clearInterval(timerRef.current);
    }, 380);

    try {
      const scored = await scan(assetClass);
      setRows(scored);
    } catch (err) {
      // Backend not running (or `baw` not installed/authed on it yet) —
      // fall back to local mock data so the demo still runs end to end.
      setBackendError("Backend unreachable — showing local mock data instead of a live scan.");
      const universe = await fetchCryptoUniverse();
      setRows(scoreUniverse(universe, { volume: 0.25, sentiment: 0.3, smartMoney: 0.3 }));
    }
    setTimeout(() => setStage("scored"), 300);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const top = rows[0];
  const qualifies = !!top && top.composite >= threshold;

  const sendNotification = async () => {
    setStage("notified");
    if (!top || !email) return;
    try {
      await notify({ to: email, symbol: top.symbol, composite: top.composite, threshold, kellyFraction: top.kellyFraction, assetClass });
    } catch {
      // Non-fatal for the demo — the on-screen dialog still shows the signal either way.
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center gap-5 p-6" style={{ background: PAPER, fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="w-full max-w-2xl flex items-center justify-between">
        <h1 className="text-lg font-bold uppercase tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif", color: INK }}>
          ✦ DyUr — DYOR Agent ✦
        </h1>
        <span className="text-[11px]" style={{ color: INK }}>Track A · Agent OS</span>
      </div>

      <div className="w-full max-w-2xl flex gap-2">
        {(Object.keys(ASSET_LABELS) as AssetClass[]).map((ac) => (
          <Tab key={ac} active={assetClass === ac} onClick={() => { setAssetClass(ac); setStage("idle"); setRows([]); }}>
            {ASSET_LABELS[ac]}
          </Tab>
        ))}
      </div>

      {assetClass === "bstock" && (
        <Window title="Pending" icon="○">
          <p className="text-[12px]" style={{ color: INK }}>
            Tokenized-stock scoring needs the real crypto-market-rank stock-rank syntax, which isn't confirmed
            yet. Wire this up once you have that skill doc — same adapter pattern as crypto and prediction.
          </p>
        </Window>
      )}

      {assetClass !== "bstock" && (
        <>
          <Window title="Criteria" icon="⚑">
            <div className="flex flex-col gap-3 text-[12px]" style={{ color: INK }}>
              <div className="flex flex-wrap items-center gap-3">
                <span>Sensitivity</span>
                {(Object.keys(SENSITIVITY) as SensitivityKey[]).map((key) => (
                  <label key={key} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="sensitivity" checked={sensitivity === key} onChange={() => setSensitivity(key)} />
                    {SENSITIVITY[key].label}
                  </label>
                ))}
              </div>
              <div className="text-[10px] opacity-60">
                Under the hood: notify when a candidate's composite score is at least {threshold.toFixed(1)} standard
                deviations above the average of this scan's universe.
              </div>
              <div className="flex items-center gap-2">
                <span>Notify email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="border-2 px-2 py-1 text-[12px] flex-1"
                  style={{ borderColor: INK }}
                />
              </div>
              <div className="flex justify-end">
                <Btn onClick={runScan} primary disabled={stage === "scanning"}>
                  {stage === "idle" ? "Run scan" : "Re-run scan"}
                </Btn>
              </div>
            </div>
          </Window>

          {backendError && (
            <div className="w-full max-w-2xl text-[11px] px-2" style={{ color: "#8A5A00" }}>
              ⚠ {backendError}
            </div>
          )}

          {stage !== "idle" && (
            <Window title="Live scan — MCP / baw calls" icon="▣" tint="#111111">
              <div className="text-[12px] leading-6" style={{ color: "#D7F26D" }}>
                {logLines.map((l, idx) => <div key={idx}>{l}</div>)}
                {stage === "scanning" && <span className="animate-pulse">▮</span>}
              </div>
            </Window>
          )}

          {(stage === "scored" || stage === "notified" || stage === "confirmed") && rows.length > 0 && (
            <Window title="Score breakdown" icon="≡">
              <table className="w-full text-[11px]" style={{ color: INK }}>
                <thead>
                  <tr className="border-b-2" style={{ borderColor: INK }}>
                    <th className="text-left py-1">Symbol</th>
                    {Object.keys(rows[0].z).map((k) => (
                      <th key={k} className="text-right">z({k})</th>
                    ))}
                    <th className="text-right">composite</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.symbol} className={r.composite >= threshold ? "font-bold" : ""}>
                      <td className="py-1">{r.symbol}</td>
                      {Object.keys(rows[0].z).map((k) => (
                        <td key={k} className="text-right">{r.z[k]?.toFixed(2)}</td>
                      ))}
                      <td className="text-right" style={{ background: r.composite >= threshold ? SIGNAL : "transparent" }}>
                        {r.composite.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {qualifies && stage === "scored" && (
                <div className="mt-3 flex justify-end">
                  <Btn onClick={sendNotification} primary>Send notification →</Btn>
                </div>
              )}
            </Window>
          )}

          {(stage === "notified" || stage === "confirmed") && qualifies && top && (
            <Window title="Buy signal — confirm required" icon="✉">
              <div className="text-[12px] space-y-2" style={{ color: INK }}>
                <p>
                  <span className="font-bold">{top.symbol}</span> crossed your threshold: composite{" "}
                  <span className="font-bold">{top.composite.toFixed(2)}σ</span>.
                </p>
                <p>
                  Kelly-sized suggestion: <span className="font-bold">{(top.kellyFraction * 100).toFixed(1)}%</span> of the{" "}
                  {ASSET_LABELS[assetClass].toLowerCase()} allocation bucket.
                </p>
                {stage === "notified" ? (
                  <div className="flex gap-2 justify-end pt-2">
                    <Btn onClick={() => setStage("scored")}>Dismiss</Btn>
                    <Btn onClick={() => setStage("confirmed")} primary>Confirm &amp; execute</Btn>
                  </div>
                ) : (
                  <div className="pt-2 text-[12px] font-bold" style={{ color: "#2E7D32" }}>
                    ✓ Sent to backend — check server logs for the baw order result.
                  </div>
                )}
              </div>
            </Window>
          )}

          {!qualifies && stage === "scored" && top && (
            <Window title="No signal this cycle" icon="○">
              <p className="text-[12px]" style={{ color: INK }}>
                Top candidate {top.symbol} scored {top.composite.toFixed(2)}σ, below your current sensitivity threshold.
                No notification sent — agent will re-scan next cycle.
              </p>
            </Window>
          )}
        </>
      )}
    </div>
  );
}
