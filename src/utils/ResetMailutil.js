const mailer = require("nodemailer");
require("dotenv").config();

const { resetEmailTemplate } = require("./EmailTemplates");

const sendResetMail = async (to, resetUrl) => {

  const transporter = mailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const htmlContent = resetEmailTemplate(resetUrl);

  const mailOptions = {
    from: `"E-Auction" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: "Reset Your E-Auction Password 🔑",
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
