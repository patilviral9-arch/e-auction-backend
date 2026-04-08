const mongoose = require("mongoose");
const Schema   = mongoose.Schema;

// ── Transaction sub-document ──────────────────────────────────────────────────
const transactionSchema = new Schema(
    {
        type: {
            type: String,
            enum: ["credit", "debit"],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        label: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            enum: ["add_money", "bid_placed", "refund", "auction_won", "payout", "lock", "unlock", "penalty", "other"],
            default: "other",
        },
        referenceId: {
            type: Schema.Types.ObjectId,
            default: null,
        },
        status: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "completed",
        },
    },
    { timestamps: true }
);

// ── Lock sub-document — one per auction the user has deposited into ───────────
const lockSchema = new Schema(
    {
        auctionId: {
            type: Schema.Types.ObjectId,
            ref: "Auction",
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: ["active", "released", "forfeited"],
            default: "active",
        },
    },
    { timestamps: true }
);

// ── Saved card sub-document ───────────────────────────────────────────────────
const cardSchema = new Schema(
    {
        type: {
            type: String,
            enum: ["visa", "master", "amex", "rupay", "other"],
            default: "visa",
        },
        last4: {
            type: String,
            required: true,
            minlength: 4,
            maxlength: 4,
        },
        expiry: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// ── Wallet root document ──────────────────────────────────────────────────────
const walletSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        // firstName+lastName for personal accounts, businessName for business
        userName: {
            type: String,
            default: "",
            trim: true,
        },
        // Spendable balance — does NOT include lockedBalance
        balance: {
            type: Number,
            default: 0,
            min: 0,
        },
        // Sum of all active security deposits across auctions
        lockedBalance: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalAdded: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalSpent: {
            type: Number,
            default: 0,
            min: 0,
        },
        transactions: [transactionSchema],
        locks:        [lockSchema],
        cards:        [cardSchema],
    },
    { timestamps: true }
);

module.exports = mongoose.model("Wallet", walletSchema);
