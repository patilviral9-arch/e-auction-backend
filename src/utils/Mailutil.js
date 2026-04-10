const { Resend } = require("resend");
const mailer = require("nodemailer");
require("dotenv").config();
const { generateAuctionEmail, resetEmailTemplate, generateOtpEmail } = require("./EmailTemplates");

const normalizeRecipient = (to) => String(to || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const mailSend = async (to, subject, content, type) => {
  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_PASS;

  if (!user || !pass) {
    throw new Error("Brevo credentials missing. Set BREVO_USER and BREVO_PASS in environment variables.");
  }

  const recipient = normalizeRecipient(to);
  if (!isValidEmail(recipient)) {
    throw new Error(`Invalid recipient email: ${to}`);
  }

  let htmlContent;
  if (type === "otp") {
    htmlContent = generateOtpEmail(content);
  } else if (type === "reset") {
    htmlContent = resetEmailTemplate(content);
  } else {
    htmlContent = generateAuctionEmail(content);
  }

  const transporter = mailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  try {
    const mailResponse = await transporter.sendMail({
      from: `"E-Auction" <${user}>`,
      to: recipient,
      subject,
      html: htmlContent,
    });

    console.log("Email Sent ID:", mailResponse.messageId);
    return mailResponse;
  } catch (error) {
    console.error("Mail Error:", error.message);
    throw error;
  }
};

module.exports = mailSend;
