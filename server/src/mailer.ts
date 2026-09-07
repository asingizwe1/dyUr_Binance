import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function actionUrl(assetClass: string, symbol: string): string {
  if (assetClass === "crypto") {
    // Confirmed working for spot-listed majors (BTC, ETH, etc.) — will 404
    // for smaller/DEX-only tokens not on Binance spot.
    return `https://www.binance.com/en/trade/${symbol}_USDT`;
  }
  // No confirmed public Binance URL for bstock/prediction markets —
  // send back into the app itself instead of guessing a dead link.
  return process.env.APP_URL ?? "http://localhost:5173";
}

export async function sendSignalEmail(params: {
  to: string;
  symbol: string;
  composite: number;
  threshold: number;
  kellyFraction: number;
  assetClass: string;
}) {
  const { to, symbol, composite, threshold, kellyFraction, assetClass } = params;
  const link = actionUrl(assetClass, symbol);
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: `DyUr signal: ${symbol} crossed your threshold`,
    html: `
      <h2>${symbol} (${assetClass})</h2>
      <p>Composite score: <b>${composite.toFixed(2)}σ</b> (your threshold: ${threshold.toFixed(2)}σ)</p>
      <p>Kelly-sized suggestion: <b>${(kellyFraction * 100).toFixed(1)}%</b> of this asset class's allocation bucket.</p>
      <p><a href="${link}">View / act on this →</a></p>
      <p>Nothing has been executed. Open the app to confirm or dismiss.</p>
    `,
  });
}