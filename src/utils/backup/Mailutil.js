const mailer = require("nodemailer")
require("dotenv").config()

const { generateAuctionEmail } = require("./EmailTemplates")


const mailSend = async(to,subject,userName)=>{

    const transporter = mailer.createTransport({
        service:"gmail",
        auth:{
            user:process.env.EMAIL_USER,
            pass:process.env.EMAIL_PASSWORD
        }
    })

    
    const htmlContent = generateAuctionEmail(userName);
    const mailOptions  = {
        from: `"E-Auction" <${process.env.EMAIL_USER}>`,
        to:to,
        subject:subject,
        html:htmlContent
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