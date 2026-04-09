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

const sendResetMail = async (to, resetUrl) => {
  const { user, pass } = getMailConfig();

  const transporter = mailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  const htmlContent = resetEmailTemplate(resetUrl);

  const mailOptions = {
    from: `"E-Auction" <${user}>`,
    to,
    subject: "Reset Your E-Auction Password",
    html: htmlContent,
  };

  try {
    const mailResponse = await transporter.sendMail(mailOptions);
    console.log("Reset Email Sent ID:", mailResponse.messageId);
    return mailResponse;
  } catch (error) {
    console.error("Reset Mail Error:", error);
    throw error;
  }
};

module.exports = sendResetMail;
