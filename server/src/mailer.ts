import nodemailer from "nodemailer";

/**
 * Simple SMTP setup — works with Gmail (app password, not your normal
 * password) or any SMTP provider (SendGrid free tier, Mailtrap for
 * testing without sending real mail). Set these as environment
 * variables, never commit them.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendSignalEmail(params: {
  to: string;
  symbol: string;
  composite: number;
  threshold: number;
  kellyFraction: number;
  assetClass: string;
}) {
  const { to, symbol, composite, threshold, kellyFraction, assetClass } = params;
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: `DyUr signal: ${symbol} crossed your threshold`,
    html: `
      <h2>${symbol} (${assetClass})</h2>
      <p>Composite score: <b>${composite.toFixed(2)}σ</b> (your threshold: ${threshold.toFixed(2)}σ)</p>
      <p>Kelly-sized suggestion: <b>${(kellyFraction * 100).toFixed(1)}%</b> of this asset class's allocation bucket.</p>
      <p>Nothing has been executed. Open the app to confirm or dismiss.</p>
    `,
  });
}
