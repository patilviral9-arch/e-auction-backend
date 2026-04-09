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

const normalizeRecipient = (to) => String(to || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const createTransporter = () => {
    const { user, pass } = getMailConfig();
    return mailer.createTransport({
        host: "smtp.gmail.com", // Set this explicitly to Gmail's host
        port: 587,
        secure: false,
        family: 4, // Keeps the fix for Render's IPv6 timeout
        auth: { user: user, // 2. Must use the 'user' variable from above
            pass: pass }
    });
};

// mailSend(to, subject, content, type)
// type: "welcome" | "otp" | "reset" | undefined (defaults to welcome)
const mailSend = async (to, subject, content, type) => {
    const transporter = createTransporter();
    const { user } = getMailConfig();
    const recipient = normalizeRecipient(to);

    if (!isValidEmail(recipient)) {
        throw new Error(`Invalid recipient email: ${to}`);
    }

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
        to: recipient,
        subject,
        html: htmlContent
    }

    try {
        const mailResponse = await transporter.sendMail(mailOptions);
        if (!Array.isArray(mailResponse.accepted) || mailResponse.accepted.length === 0) {
            const rejected = Array.isArray(mailResponse.rejected) ? mailResponse.rejected.join(", ") : "unknown";
            throw new Error(`Email not accepted by SMTP server. Rejected: ${rejected}`);
        }
        console.log("Email Sent ID:", mailResponse.messageId);
        return mailResponse;
    } catch (error) {
        console.error("Nodemailer Error:", error);
        throw error;
    }
}

module.exports = mailSend
