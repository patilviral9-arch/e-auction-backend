const mailer = require("nodemailer");
require("dotenv").config();

const { resetEmailTemplate } = require("./EmailTemplates");

const getMailConfig = () => {
  const user = String(process.env.EMAIL_USER || "").trim();
  const pass = String(process.env.EMAIL_PASSWORD || "").replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error("Email credentials are missing. Set EMAIL_USER and EMAIL_PASSWORD in backend .env");
  }

  return { user, pass };
};

const normalizeRecipient = (to) => String(to || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const sendResetMail = async (to, resetUrl) => {
  const { user, pass } = getMailConfig();
  const recipient = normalizeRecipient(to);

  if (!isValidEmail(recipient)) {
    throw new Error(`Invalid recipient email: ${to}`);
  }

  const transporter = mailer.createTransport({
    service: "gmail",
    family: 4,
    connectionTimeout: 25000,
    auth: {
      user,
      pass,
    },
  });

  const htmlContent = resetEmailTemplate(resetUrl);

  const mailOptions = {
    from: `"E-Auction" <${user}>`,
    to: recipient,
    subject: "Reset Your E-Auction Password",
    html: htmlContent,
  };

  try {
    const mailResponse = await transporter.sendMail(mailOptions);
    if (!Array.isArray(mailResponse.accepted) || mailResponse.accepted.length === 0) {
      const rejected = Array.isArray(mailResponse.rejected) ? mailResponse.rejected.join(", ") : "unknown";
      throw new Error(`Reset email not accepted by SMTP server. Rejected: ${rejected}`);
    }
    console.log("Reset Email Sent ID:", mailResponse.messageId);
    return mailResponse;
  } catch (error) {
    console.error("Reset Mail Error:", error);
    throw error;
  }
};

module.exports = sendResetMail;
