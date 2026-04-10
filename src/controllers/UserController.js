const userschema  = require('../models/Usermodel');
const bcrypt       = require("bcrypt");
const mailSend     = require('../utils/Mailutil');
const sendResetMail = require('../utils/ResetMailutil');
const jwt          = require("jsonwebtoken");
const secret       = process.env.JWT_SECRET_KEY;

// In-memory OTP store { email -> { otp, expiresAt } }
// For production swap this with Redis or a DB collection
const otpStore = new Map();
const normalizeEmail = (value) => String(value || "").toLowerCase().trim();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const OTP_TTL_MS = Number(process.env.OTP_TTL_MS || 10 * 60 * 1000);
const OTP_USER_LOOKUP_TIMEOUT_MS = Number(process.env.OTP_USER_LOOKUP_TIMEOUT_MS || 60000);
const OTP_EMAIL_TIMEOUT_MS = Number(process.env.OTP_EMAIL_TIMEOUT_MS || 60000);
const OTP_POOL = [
    "103842", "204713", "315904", "426195", "537286", "648377", "759468", "860559", "971640", "182731",
    "293822", "304913", "415024", "526135", "637246", "748357", "859468", "960579", "171680", "282791",
    "393802", "404913", "515024", "626135", "737246", "848357", "959468", "160579", "271680", "382791",
    "493802", "504913", "615024", "726135", "837246", "948357", "159468", "260579", "371680", "482791",
    "593802", "604913", "715024", "826135", "937246", "148357", "259468", "360579", "471680", "582791",
];

const withTimeout = (promise, ms, label = "Operation") =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);

        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });

// OTP helpers

// ── POST /user/send-otp ───────────────────────────────────────────────────────
// Called by Signup before showing the OTP prompt.
// Selects one OTP from a fixed 50-code pool, stores it, and emails it.
const sendOtp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: "Email is required." });
    if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });

    try {
        // Duplicate check is best-effort; OTP should not hang if DB is slow.
        try {
            const existing = await withTimeout(
                userschema.findOne({ email }).lean(),
                OTP_USER_LOOKUP_TIMEOUT_MS,
                "User lookup"
            );
            if (existing) {
                return res.status(409).json({ message: "An account with this email already exists." });
            }
        } catch (lookupErr) {
            console.warn("[sendOtp] User lookup skipped:", lookupErr.message);
        }

        const randomIndex = Math.floor(Math.random() * OTP_POOL.length);
        const otp = OTP_POOL[randomIndex];
        const expiresAt = Date.now() + OTP_TTL_MS;
        otpStore.set(email, { otp, expiresAt });

        await withTimeout(
            mailSend(email, "Your E-Auction Verification Code", otp, "otp"),
            OTP_EMAIL_TIMEOUT_MS,
            "OTP email send"
        );

        res.status(200).json({
            message: "OTP sent to your email successfully.",
            expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        });
    } catch (err) {
        console.error("sendOtp error:", err);
        res.status(500).json({
            message: "Failed to send OTP.",
            err: String(err?.message || err),
        });
    }
};

const resendOtp = async (req, res) => {
    return sendOtp(req, res);
};

// ── POST /user/verify-otp ─────────────────────────────────────────────────────
// Called by Signup before registering the user.
// Returns 200 if valid, 400/410 if wrong or expired.
const verifyOtp = (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();
    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required." });
    }

    if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ message: "Enter a valid 6-digit OTP." });
    }

    const record = otpStore.get(email);
    if (!record) {
        return res.status(400).json({ message: "No OTP found for this email. Please request a new one." });
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return res.status(410).json({ message: "OTP has expired. Please request a new one." });
    }

    if (record.otp !== otp) {
        return res.status(400).json({ message: "Incorrect OTP. Please try again." });
    }

    otpStore.delete(email);
    res.status(200).json({ message: "OTP verified successfully." });
};

// ── POST /user/register ───────────────────────────────────────────────────────
const registerUser = async (req, res) => {
    try {
        if (!req.body || !req.body.password) {
            return res.status(400).json({ message: "Password is required to create an account." });
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const savedUser      = await userschema.create({ ...req.body, password: hashedPassword });

        res.status(201).json({ message: "User created successfully", data: savedUser });

        const displayName = savedUser.role === 'business'
            ? savedUser.businessName
            : savedUser.firstName;

        try {
            await mailSend(savedUser.email, "Welcome to E-Auction!", displayName, "welcome");
        } catch (mailError) {
            console.error("Welcome mail failed:", mailError);
        }

    } catch (err) {
        console.error("Mongoose Error:", err);
        res.status(500).json({ message: "Error while creating user", err: err.message });
    }
};

// ── POST /user/login ──────────────────────────────────────────────────────────
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const founduserfromemail = await userschema.findOne({ email: normalizedEmail });

    if (!founduserfromemail) {
        return res.status(404).json({ message: "User not found" });
    }

    const status = String(founduserfromemail.status || "").toLowerCase();
    if (status === "inactive" || status === "deactive") {
        return res.status(403).json({ message: "Your account is deactivated. Please contact admin." });
    }
    if (status === "blocked" || status === "suspended") {
        return res.status(403).json({ message: "Your account is suspended. Please contact admin." });
    }
    if (status === "deleted") {
        return res.status(403).json({ message: "Your account is unavailable. Please contact admin." });
    }

    const ispasswordmatched = await bcrypt.compare(password, founduserfromemail.password);
    if (ispasswordmatched) {
        const token = jwt.sign(founduserfromemail.toObject(), secret);
        return res.status(200).json({
            message: "Login success",
            token,
            data: founduserfromemail,
            role: founduserfromemail.role,
        });
    }

    return res.status(401).json({ message: "Invalid credentials" });
};

// ── GET /user/getusers ────────────────────────────────────────────────────────
const getallusers = async (req, res) => {
    try {
        const allusers = await userschema.find();
        res.status(200).json({ message: "All users", data: allusers });
    } catch (err) {
        res.status(500).json({ message: "Error while fetching users", err: err.message });
    }
};

// ── PUT /user/updateuser/:id ──────────────────────────────────────────────────
const updateUser = async (req, res) => {
    try {
        const updatedusers = await userschema.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.status(200).json({ message: "User updated successfully", data: updatedusers });
    } catch (err) {
        res.status(500).json({ message: "Error while updating user", err: err.message });
    }
};

// ── DELETE /user/deleteuser/:id ───────────────────────────────────────────────
const deleteUser = async (req, res) => {
    try {
        const deltedusers = await userschema.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "User deleted successfully", data: deltedusers });
    } catch (err) {
        res.status(500).json({ message: "Error while deleting user" });
    }
};

// ── GET /user/getuser/:id ─────────────────────────────────────────────────────
const getUser = async (req, res) => {
    try {
        const user = await userschema.findById(req.params.id);
        res.status(200).json({ message: "User found", data: user });
    } catch (err) {
        res.status(500).json({ message: "Error fetching user", err: err.message });
    }
};

// ── POST /user/forgetpassword ─────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is not provided." });

    try {
        const foundUserFromEmail = await userschema.findOne({ email });
        if (!foundUserFromEmail) return res.status(404).json({ message: "User not found." });

        const token = jwt.sign(
            { _id: foundUserFromEmail._id, email: foundUserFromEmail.email },
            secret,
            { expiresIn: "15m" }
        );

        const resetUrl = `https://e-auction-e617.vercel.app/resetpassword/${token}`;
        await sendResetMail(foundUserFromEmail.email, resetUrl);

        res.status(200).json({ message: "Reset link has been sent to your email." });
    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ message: "Server error.", err: err.message });
    }
};

// ── PUT /user/resetpassword ───────────────────────────────────────────────────
const resetPassword = async (req, res) => {
    const { newPassword, token } = req.body;
    try {
        const decodedUser    = jwt.verify(token, secret);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await userschema.findByIdAndUpdate(decodedUser._id, { password: hashedPassword });
        res.status(200).json({ message: "Password reset successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error.", err });
    }
};

module.exports = {
    sendOtp,
    resendOtp,
    verifyOtp,
    registerUser,
    loginUser,
    getallusers,
    updateUser,
    deleteUser,
    getUser,
    forgotPassword,
    resetPassword,
};
