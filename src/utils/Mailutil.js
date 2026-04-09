const mailer = require("nodemailer")
require("dotenv").config()

const { generateAuctionEmail, resetEmailTemplate, generateOtpEmail } = require("./EmailTemplates")

const getMailConfig = () => {
    const user = String(process.env.EMAIL_USER || "").trim();
    const pass = String(process.env.EMAIL_PASSWORD || "").replace(/\s+/g, "");

    if (!user || !pass) {
        throw new Error("Email credentials are missing. Set EMAIL_USER and EMAIL_PASSWORD in backend .env");
    }

    return { user, pass };
};

const createTransporter = () => {
    const { user, pass } = getMailConfig();
    return mailer.createTransport({
        host: process.env.EMAIL_USER, // Specify host
        port: 587,              // Use port 587
        secure: false,           // Use false for port 587
        family: 4,              // Force IPv4 to prevent the ESOCKET error in logs
        auth: { user, pass }
    });
};

// mailSend(to, subject, content, type)
// type: "welcome" | "otp" | "reset" | undefined (defaults to welcome)
const mailSend = async (to, subject, content, type) => {
    const transporter = createTransporter();
    const { user } = getMailConfig();

    let htmlContent;

    if (type === "otp") {
        // content = the 6-digit OTP string
        htmlContent = generateOtpEmail(content);
    } else if (type === "reset") {
        // content = the reset URL
        htmlContent = resetEmailTemplate(content);
    } else {
        // default: welcome email — content = userName
        htmlContent = generateAuctionEmail(content);
    }

    const mailOptions = {
        from: `"E-Auction" <${user}>`,
        to,
        subject,
        html: htmlContent
    }

    try {
        const mailResponse = await transporter.sendMail(mailOptions);
        console.log("Email Sent ID:", mailResponse.messageId);
        return mailResponse;
    } catch (error) {
        console.error("Nodemailer Error:", error);
        throw error;
    }
}

module.exports = mailSend
