const { Resend } = require("resend");
require("dotenv").config();
const { resetEmailTemplate } = require("./EmailTemplates");

const normalizeRecipient = (to) => String(to || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const sendResetMail = async (to, resetUrl) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing. Set it in your backend .env");
  }

  const recipient = normalizeRecipient(to);
  if (!isValidEmail(recipient)) {
    throw new Error(`Invalid recipient email: ${to}`);
  }

  const resend = new Resend(apiKey);
  const htmlContent = resetEmailTemplate(resetUrl);

  try {
    const { data, error } = await resend.emails.send({
      from: "E-Auction <onboarding@resend.dev>", // replace once you verify your own domain
      to: recipient,
      subject: "Reset Your E-Auction Password",
      html: htmlContent,
    });

    if (error) {
      console.error("Reset Mail Error:", error);
      throw new Error(`Reset email failed: ${error.message}`);
    }

    console.log("Reset Email Sent ID:", data.id);
    return data;
  } catch (err) {
    console.error("Reset Mail Error:", err);
    throw err;
  }
};

module.exports = sendResetMail;
