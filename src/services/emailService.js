/**
 * Minimal email sender for verification mail.
 *
 * If SMTP_HOST isn't set (e.g. local dev), this falls back to logging the
 * verification link to the console instead of throwing — so register()
 * keeps working exactly as it does today even before you've wired up a
 * real mail provider (SendGrid, Resend, SES, Mailgun's SMTP, etc.).
 */
let nodemailer;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = null;
}

function getTransport() {
  if (!nodemailer || !process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

function verifyLink(token) {
  const base = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
  return `${base}/auth/verify-email/${token}`;
}

async function sendVerificationEmail(user, token) {
  const link = verifyLink(token);
  const transport = getTransport();

  if (!transport) {
    // Dev fallback — no SMTP configured yet.
    console.log(`[emailService] SMTP not configured — verification link for ${user.email}:\n  ${link}`);
    return { delivered: false, link };
  }

  await transport.sendMail({
    from: process.env.EMAIL_FROM || "PulseLine <no-reply@pulseline.app>",
    to: user.email,
    subject: "Verify your PulseLine account",
    text: `Welcome to PulseLine! Verify your email:\n\n${link}\n\nThis link expires in 24 hours.`,
    html: `<p>Welcome to PulseLine!</p><p><a href="${link}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
  });
  return { delivered: true, link };
}

module.exports = { sendVerificationEmail };
