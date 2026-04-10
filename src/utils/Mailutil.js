const { Resend } = require("resend");
const nodemailer = require("nodemailer");
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
const EMAIL_SEND_TIMEOUT_MS = Number(process.env.EMAIL_SEND_TIMEOUT_MS || 120000);

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
    return null;
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

  const useDevFrom = String(process.env.RESEND_USE_DEV_FROM || "true")
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

const shouldFallbackToSmtp = (message) => {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("you can only send testing emails") ||
    text.includes("only send testing emails to your own email address") ||
    text.includes("verify a domain") ||
    text.includes("resend.com/domains")
  );
};

const getSmtpTransporters = () => {
  const user = String(process.env.EMAIL_USER || "").trim();
  const pass = String(process.env.EMAIL_PASSWORD || "").trim();
  if (!user || !pass) return [];

  const connectionTimeout = Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 120000);
  const greetingTimeout = Number(process.env.MAIL_GREETING_TIMEOUT_MS || 120000);
  const socketTimeout = Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 300000);
  const common = {
    auth: { user, pass },
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
  };

  const transports = [];
  const host = String(process.env.SMTP_HOST || "").trim();
  if (host) {
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = String(process.env.SMTP_SECURE || String(port === 465))
      .trim()
      .toLowerCase() === "true";
    transports.push(nodemailer.createTransport({ ...common, host, port, secure }));
    return transports;
  }

  const service = String(process.env.SMTP_SERVICE || "").trim();
  if (service) {
    transports.push(nodemailer.createTransport({ ...common, service }));
  }

  transports.push(nodemailer.createTransport({
    ...common,
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
  }));
  transports.push(nodemailer.createTransport({
    ...common,
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
  }));
  return transports;
};

const sendViaSmtp = async ({ transporters, recipient, subject, htmlContent }) => {
  const smtpUser = String(process.env.EMAIL_USER || "").trim();
  const from = String(process.env.EMAIL_FROM || "").trim() || `"E-Auction" <${smtpUser}>`;
  let lastError = null;

  for (let i = 0; i < transporters.length; i += 1) {
    const transporter = transporters[i];
    try {
      const info = await withTimeout(
        transporter.sendMail({
          from,
          to: recipient,
          subject,
          html: htmlContent,
        }),
        EMAIL_SEND_TIMEOUT_MS,
        `SMTP email send (attempt ${i + 1})`
      );
      console.log("SMTP Email Sent ID:", info?.messageId || "n/a");
      return info;
    } catch (err) {
      lastError = err;
      console.warn(`[mailSend] SMTP attempt ${i + 1} failed: ${String(err?.message || err)}`);
    }
  }

  throw lastError || new Error("SMTP email send failed.");
};

// mailSend(to, subject, content, type)
// type: "welcome" | "otp" | "reset" | undefined (defaults to welcome)
const mailSend = async (to, subject, content, type) => {
  const recipient = normalizeRecipient(to);
  if (!isValidEmail(recipient)) {
    throw new Error(`Invalid recipient email: ${to}`);
  }

  const htmlContent = pickHtmlTemplate(content, type);
  const smtpTransporters = getSmtpTransporters();
  const resend = getResendClient();
  if (resend) {
    const from = getFromAddress();
    const payload = {
      from,
      to: [recipient],
      subject,
      html: htmlContent,
    };

    try {
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
    } catch (err) {
      const msg = String(err?.message || err);
      if (smtpTransporters.length > 0 && shouldFallbackToSmtp(msg)) {
        console.warn("[mailSend] Resend limited in test mode; falling back to SMTP.");
        return sendViaSmtp({ transporters: smtpTransporters, recipient, subject, htmlContent });
      }
      throw err;
    }
  }

  if (smtpTransporters.length > 0) {
    return sendViaSmtp({ transporters: smtpTransporters, recipient, subject, htmlContent });
  }

  throw new Error(
    "Email credentials are missing. Set RESEND_API_KEY (with EMAIL_FROM/RESEND_USE_DEV_FROM) or EMAIL_USER and EMAIL_PASSWORD."
  );
};

module.exports = mailSend;
