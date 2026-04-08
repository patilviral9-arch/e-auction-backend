const mongoose = require("mongoose");

const auctionResultSchema = new mongoose.Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
    },

    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ✅ Seller reference — populated from auction.createdBy at result creation time
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Denormalized snapshots — set at creation time for fast display

    // Winner display name:
    //   personal role → "firstName lastName"
    //   business role → businessName
    winnerName: {
      type: String,
      default: "",
    },

    // Seller name — taken from the auction's createdBy user doc
    sellerName: {
      type: String,
      default: "",
    },

    auctionTitle: {
      type: String,
      default: "",
    },

    winningBid: {
      type: Number,
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      default: "",
      trim: true,
    },

    paymentId: {
      type: String,
      default: "",
      trim: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate results for the same auction
auctionResultSchema.index({ auction: 1 }, { unique: true });

module.exports = mongoose.model("AuctionResult", auctionResultSchema);
