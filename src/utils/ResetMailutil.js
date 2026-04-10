const mailer = require("nodemailer");
require("dotenv").config();
const { resetEmailTemplate } = require("./EmailTemplates");

const normalizeRecipient = (to) => String(to || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const sendResetMail = async (to, resetUrl) => {
  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_PASS;

  if (!user || !pass) {
    throw new Error("Brevo credentials missing. Set BREVO_USER and BREVO_PASS in environment variables.");
  }

  const recipient = normalizeRecipient(to);
  if (!isValidEmail(recipient)) {
    throw new Error(`Invalid recipient email: ${to}`);
  }

  const transporter = mailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  const htmlContent = resetEmailTemplate(resetUrl);

  try {
    const mailResponse = await transporter.sendMail({
      from: `"E-Auction" <${user}>`,
      to: recipient,
      subject: "Reset Your E-Auction Password",
      html: htmlContent,
    });

    console.log("Reset Email Sent ID:", mailResponse.messageId);
    return mailResponse;
  } catch (error) {
    console.error("Reset Mail Error:", error);
    throw error;
  }
};

module.exports = sendResetMail;
