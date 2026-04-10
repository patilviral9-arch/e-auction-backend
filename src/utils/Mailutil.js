const { Resend } = require("resend");
require("dotenv").config();

const { generateAuctionEmail, resetEmailTemplate, generateOtpEmail } = require("./EmailTemplates");

const normalizeRecipient = (to) => String(to || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    return explicitFrom;
  }

  const fallbackEmail = String(process.env.EMAIL_USER || "").trim();
  if (fallbackEmail && isValidEmail(fallbackEmail)) {
    return `"E-Auction" <${fallbackEmail}>`;
  }

  throw new Error("Email sender is missing. Set EMAIL_FROM in backend .env");
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
