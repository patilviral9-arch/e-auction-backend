const mailSend = require("./Mailutil");

const sendResetMail = async (to, resetUrl) => {
  return mailSend(to, "Reset Your E-Auction Password", resetUrl, "reset");
};

module.exports = sendResetMail;
