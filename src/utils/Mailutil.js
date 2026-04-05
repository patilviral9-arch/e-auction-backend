const mailer = require("nodemailer")
require("dotenv").config()

const { generateAuctionEmail, resetEmailTemplate, generateOtpEmail } = require("./EmailTemplates")

// mailSend(to, subject, content, type)
// type: "welcome" | "otp" | "reset" | undefined (defaults to welcome)
const mailSend = async (to, subject, content, type) => {

    const transporter = mailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    })

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
        from: `"E-Auction" <${process.env.EMAIL_USER}>`,
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