const { Resend } = require("resend");
require("dotenv").config();

const { generateAuctionEmail, resetEmailTemplate, generateOtpEmail } = require("./EmailTemplates");

const normalizeRecipient = (to) => String(to || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const parseAddressEmail = (value) => {
  const text = String(value || "").trim();
  const bracketMatch = text.match(/<([^>]+)>/);
  return String(bracketMatch ? bracketMatch[1] : text).trim().toLowerCase();
};
const isConsumerMailboxDomain = (value) =>
  /@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|live\.com|icloud\.com)$/i.test(value);
const EMAIL_SEND_TIMEOUT_MS = Number(process.env.EMAIL_SEND_TIMEOUT_MS || 45000);

const withTimeout = (promise, ms, label = "Email send") =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const getResendClient = () => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Email credentials are missing. Set RESEND_API_KEY in backend .env");
  }
  return new Resend(apiKey);
};

const getFromAddress = () => {
  const explicitFrom = String(process.env.EMAIL_FROM || "").trim();
  if (explicitFrom) {
    const fromEmail = parseAddressEmail(explicitFrom);
    if (!isValidEmail(fromEmail)) {
      throw new Error("EMAIL_FROM is invalid. Use format: E-Auction <noreply@yourdomain.com>");
    }
    if (isConsumerMailboxDomain(fromEmail)) {
      throw new Error(
        "EMAIL_FROM must use your own verified domain in Resend (gmail/outlook/yahoo are not allowed)."
      );
    }
    return explicitFrom;
  }

  const useDevFrom = String(process.env.RESEND_USE_DEV_FROM || "")
    .trim()
    .toLowerCase() === "true";
  if (useDevFrom) {
    return '"E-Auction" <onboarding@resend.dev>';
  }

  throw new Error(
    "Email sender is missing. Set EMAIL_FROM with a verified domain, or set RESEND_USE_DEV_FROM=true for local testing."
  );
};

const pickHtmlTemplate = (content, type) => {
  if (type === "otp") {
    return generateOtpEmail(content);
  }
  if (type === "reset") {
    return resetEmailTemplate(content);
  }
  return generateAuctionEmail(content);
};

// mailSend(to, subject, content, type)
// type: "welcome" | "otp" | "reset" | undefined (defaults to welcome)
const mailSend = async (to, subject, content, type) => {
  const recipient = normalizeRecipient(to);
  if (!isValidEmail(recipient)) {
    throw new Error(`Invalid recipient email: ${to}`);
  }

  const resend = getResendClient();
  const htmlContent = pickHtmlTemplate(content, type);
  const from = getFromAddress();

  const payload = {
    from,
    to: [recipient],
    subject,
    html: htmlContent,
  };

  const result = await withTimeout(
    resend.emails.send(payload),
    EMAIL_SEND_TIMEOUT_MS,
    "Resend email send"
  );

  if (result?.error) {
    const apiError = result.error?.message || JSON.stringify(result.error);
    throw new Error(`Resend API error: ${apiError}`);
  }

  if (!result?.data?.id) {
    throw new Error("Resend did not return a message id.");
  }

  console.log("Email Sent ID:", result.data.id);
  return result.data;
};

module.exports = mailSend;
