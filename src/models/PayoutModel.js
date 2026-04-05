const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// ── Bank Account Sub-Schema ───────────────────────────────────────────────────
const bankAccountSchema = new Schema(
  {
    logoText:    { type: String },                          // e.g. "SBI", "HDFC", "UPI"
    name:        { type: String, required: true },          // e.g. "State Bank of India"
    accountNum:  { type: String, required: true },          // masked or UPI id
    ifsc:        { type: String },                          // null for UPI
    accountType: { type: String, enum: ["Savings", "Current", "UPI"], default: "Savings" },
    isDefault:   { type: Boolean, default: false },
  },
  { _id: true }
);

// ── Payout Transaction Sub-Schema ─────────────────────────────────────────────
const transactionSchema = new Schema(
  {
    payoutId:     { type: String },                         // e.g. "PYT-9941"
    auctionId:    { type: Schema.Types.ObjectId, ref: "Auction" },
    auctionTitle: { type: String },
    amount:       { type: Number, required: true },
    method:       { type: String, default: "Bank Transfer" }, // Bank Transfer / UPI / NEFT
    status: {
      type: String,
      enum: ["Pending", "Processing", "Paid", "Failed"],
      default: "Pending",
    },
    date:         { type: Date, default: Date.now },
    note:         { type: String },                         // optional internal note
  },
  { _id: true, timestamps: true }
);

// ── Main Payout Schema ────────────────────────────────────────────────────────
const payoutSchema = new Schema(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,               // one payout wallet per seller
    },

    // ── Balances ──────────────────────────────────────────────────────────────
    availableBalance: { type: Number, default: 0 },         // ready to withdraw
    pendingAmount:    { type: Number, default: 0 },         // in Processing / Pending
    totalEarned:      { type: Number, default: 0 },         // lifetime gross
    totalAuctions:    { type: Number, default: 0 },         // auctions closed

    // ── Linked bank / UPI accounts ────────────────────────────────────────────
    banks:            { type: [bankAccountSchema], default: [] },

    // ── Transaction history ───────────────────────────────────────────────────
    transactions:     { type: [transactionSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payout", payoutSchema);
