const { Resend } = require("resend"); // 🟢 Requires: npm install resend
require("dotenv").config();

const { 
    generateAuctionEmail, 
    resetEmailTemplate, 
    generateOtpEmail 
} = require("./EmailTemplates");

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

const normalizeRecipient = (to) => String(to || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * mailSend(to, subject, content, type)
 * type: "welcome" | "otp" | "reset" | undefined
 */
const mailSend = async (to, subject, content, type) => {
    const recipient = normalizeRecipient(to);

    if (!isValidEmail(recipient)) {
        throw new Error(`Invalid recipient email: ${to}`);
    }

    // Select the correct template based on type
    let htmlContent;
    if (type === "otp") {
        htmlContent = generateOtpEmail(content);
    } else if (type === "reset") {
        htmlContent = resetEmailTemplate(content);
    } else {
        htmlContent = generateAuctionEmail(content);
    }

    try {
        const { data, error } = await resend.emails.send({
            // 🟢 IMPORTANT: 'onboarding@resend.dev' only sends to your own email address
            // To send to any user, you must verify a domain in the Resend dashboard.
            from: 'E-Auction <onboarding@resend.dev>', 
            to: recipient,
            subject: subject,
            html: htmlContent,
        });

        if (error) {
            console.error("Resend API Error:", error.message);
            throw new Error(error.message);
        }

        console.log("Email Sent via Resend. ID:", data.id);
        return data;
    } catch (err) {
        console.error("Mailutil Final Failure:", err.message);
        throw err;
    }
};

module.exports = mailSend;