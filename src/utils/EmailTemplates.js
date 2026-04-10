const generateAuctionEmail = (userName) => {
    return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <tr>
                <td style="padding: 0;">
                    <img src="${process.env.EMAIL_BANNER_URL}" alt="E-Auction Banner" style="width: 100%; display: block;">
                </td>
            </tr>
            
            <tr>
                <td style="padding: 40px; text-align: center;">
                    <h1 style="margin: 0; color: #2c3e50; font-size: 28px;">Your account is ready!</h1>
                    <p style="font-size: 16px; line-height: 1.6; color: #666; margin-top: 20px;">
                        Hi <strong>${userName}</strong>, welcome to the premier destination for digital auctions. We're excited to help you find your next great deal.
                    </p>
                    
                    <div style="margin-top: 30px;">
                        <a href="http://localhost:5173/" style="background-color: #2c3e50; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Explore Auctions
                        </a>
                    </div>
                </td>
            </tr>

            <tr>
                <td style="padding: 20px; background-color: #f1f1f1; text-align: center; font-size: 12px; color: #999;">
                    © 2026 E-Auction Inc. | 123 Auction Way, Tech City<br>
                    <a href="#" style="color: #2c3e50;">Unsubscribe</a>
                </td>
            </tr>
        </table>
    </div>
    `;
};

const resetEmailTemplate = (resetUrl) => {
    return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            
            <!-- Banner -->
            <tr>
                <td style="padding: 0;">
                    <img src="${process.env.EMAIL_BANNER_URL}" alt="E-Auction Banner" style="width: 100%; display: block;">
                </td>
            </tr>

            <!-- Body -->
            <tr>
                <td style="padding: 40px; text-align: center;">
                    <h1 style="margin: 0; color: #2c3e50; font-size: 28px;">Reset Your Password</h1>
                    <p style="font-size: 16px; line-height: 1.6; color: #666; margin-top: 20px;">
                        We received a request to reset your E-Auction account password.<br>
                        Click the button below to choose a new password.
                    </p>

                    <div style="margin-top: 30px;">
                        <a href="${resetUrl}" style="background-color: #2c3e50; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Reset My Password
                        </a>
                    </div>

                    <p style="font-size: 13px; color: #999; margin-top: 24px;">
                        This link will expire in <strong style="color: #2c3e50;">15 minutes</strong>.
                    </p>

                    <!-- Warning -->
                    <div style="margin-top: 24px; background-color: #fff8e1; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 16px; text-align: left;">
                        <p style="font-size: 13px; color: #92400e; margin: 0;">
                            ⚠️ If you did not request a password reset, please ignore this email — your account remains safe and no changes will be made.
                        </p>
                    </div>

                    <!-- Security note -->
                    <div style="margin-top: 12px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 6px; padding: 12px 16px; text-align: left;">
                        <p style="font-size: 13px; color: #166534; margin: 0;">
                            🛡 For your security, never share this link with anyone. E-Auction support will <strong>never</strong> ask for your password or reset link.
                        </p>
                    </div>
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="padding: 20px; background-color: #f1f1f1; text-align: center; font-size: 12px; color: #999;">
                    © 2026 E-Auction Inc. | 123 Auction Way, Tech City<br>
                    <a href="#" style="color: #2c3e50;">Privacy Policy</a> &nbsp;·&nbsp;
                    <a href="#" style="color: #2c3e50;">Terms of Service</a>
                </td>
            </tr>
        </table>
    </div>
    `;
};

const generateOtpEmail = (otp) => {
    return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <tr>
                <td style="padding: 0;">
                    <img src="${process.env.EMAIL_BANNER_URL}" alt="E-Auction Banner" style="width: 100%; display: block;">
                </td>
            </tr>
            
            <tr>
                <td style="padding: 40px; text-align: center;">
                    <h1 style="margin: 0; color: #2c3e50; font-size: 28px;">Verify your email address</h1>
                    <p style="font-size: 16px; line-height: 1.6; color: #666; margin-top: 20px;">
                        Use the code below to complete your registration.<br>
                        This code expires in <strong>10 minutes</strong>.
                    </p>
                    
                    <div style="margin-top: 30px; background-color: #f8fafc; border: 2px dashed #2c3e50; border-radius: 12px; padding: 30px;">
                        <p style="font-size: 13px; color: #999; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 10px;">Your verification code</p>
                        <p style="font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #2c3e50; margin: 0;">${otp}</p>
                    </div>

                    <p style="font-size: 13px; color: #999; margin-top: 24px; line-height: 1.6;">
                        If you didn't request this, you can safely ignore this email.<br>
                        Someone may have entered your address by mistake.
                    </p>
                </td>
            </tr>

            <tr>
                <td style="padding: 20px; background-color: #f1f1f1; text-align: center; font-size: 12px; color: #999;">
                    © 2026 E-Auction Inc. | 123 Auction Way, Tech City<br>
                    <a href="#" style="color: #2c3e50;">Unsubscribe</a>
                </td>
            </tr>
        </table>
    </div>
    `;
};

module.exports = { generateAuctionEmail, resetEmailTemplate, generateOtpEmail };
