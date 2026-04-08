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

    // Denormalized snapshots — set at creation time for fast display
    winnerName: {
      type: String,
      default: "",
    },

    businessName: {
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
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate results for the same auction
auctionResultSchema.index({ auction: 1 }, { unique: true });

module.exports = mongoose.model("AuctionResult", auctionResultSchema);
