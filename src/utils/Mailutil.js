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
const MAIL_CONNECTION_TIMEOUT_MS = Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 30000);
const MAIL_GREETING_TIMEOUT_MS = Number(process.env.MAIL_GREETING_TIMEOUT_MS || 30000);
const MAIL_SOCKET_TIMEOUT_MS = Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 45000);

const getTransportConfigs = () => {
    const { user, pass } = getMailConfig();
    
    return [
        {
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // 🟢 Must be false for port 587 (STARTTLS)
            family: 4,     // 🟢 CRITICAL: This stops the ENETUNREACH error
            auth: { user, pass },
            connectionTimeout: MAIL_CONNECTION_TIMEOUT_MS,
            greetingTimeout: MAIL_GREETING_TIMEOUT_MS,
            socketTimeout: MAIL_SOCKET_TIMEOUT_MS,
        },
        {
            service: "gmail",
            family: 4,
            auth: { user, pass },
            connectionTimeout: MAIL_CONNECTION_TIMEOUT_MS,
            greetingTimeout: MAIL_GREETING_TIMEOUT_MS,
            socketTimeout: MAIL_SOCKET_TIMEOUT_MS,
        },
    ];
};

// mailSend(to, subject, content, type)
// type: "welcome" | "otp" | "reset" | undefined (defaults to welcome)
const mailSend = async (to, subject, content, type) => {
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

    const transportConfigs = getTransportConfigs();
    const failures = [];

    for (const config of transportConfigs) {
        const transporter = mailer.createTransport(config);
        try {
            const mailResponse = await transporter.sendMail(mailOptions);
            if (!Array.isArray(mailResponse.accepted) || mailResponse.accepted.length === 0) {
                const rejected = Array.isArray(mailResponse.rejected) ? mailResponse.rejected.join(", ") : "unknown";
                throw new Error(`Email not accepted by SMTP server. Rejected: ${rejected}`);
            }
            console.log("Email Sent ID:", mailResponse.messageId);
            return mailResponse;
        } catch (error) {
            const transportLabel = config.service
                ? `service:${config.service}`
                : `${config.host}:${config.port}${config.secure ? " (ssl)" : ""}`;
            failures.push(`${transportLabel} -> ${error.message}`);
            console.error("Nodemailer Error:", transportLabel, error.message);
        }
    }

    throw new Error(`All mail transports failed. ${failures.join(" | ")}`);
}

module.exports = mailSend
