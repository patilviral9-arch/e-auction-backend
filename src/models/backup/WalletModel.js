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
        // e.g. "add_money" | "bid_placed" | "refund" | "auction_won" | "payout"
        category: {
            type: String,
            enum: ["add_money", "bid_placed", "refund", "auction_won", "payout", "other"],
            default: "other",
        },
        // Optional reference to an auction / bid document
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
    { timestamps: true }          // gives each transaction its own createdAt / updatedAt
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
            type: String,          // stored as "MM/YY"
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
            unique: true,          // one wallet per user
        },
        userName: {
            type: String,
            default: "",
            trim: true,
        },
        balance: {
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
        cards:        [cardSchema],
    },
    { timestamps: true }
);

module.exports = mongoose.model("Wallet", walletSchema);
