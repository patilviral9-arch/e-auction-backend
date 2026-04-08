const AuctionResult = require("../models/AuctionResultModel");
const Auction       = require("../models/AuctionModel");
const User          = require("../models/UserModel");

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve winner display name based on role
//   personal → "firstName lastName"
//   business → businessName
// ─────────────────────────────────────────────────────────────────────────────
function resolveWinnerName(userDoc) {
  if (!userDoc) return "Unknown";
  const role = (userDoc.role || "").toLowerCase();
  if (role === "business") {
    return userDoc.businessName || userDoc.name || "Unknown";
  }
  const firstName = userDoc.firstName || "";
  const lastName  = userDoc.lastName  || "";
  return [firstName, lastName].filter(Boolean).join(" ") || userDoc.name || "Unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve seller display name from the auction's seller user doc
// ─────────────────────────────────────────────────────────────────────────────
function resolveSellerName(sellerDoc) {
  if (!sellerDoc) return "";
  const role = (sellerDoc.role || "").toLowerCase();
  if (role === "business") {
    return sellerDoc.businessName || sellerDoc.name || "";
  }
  const firstName = sellerDoc.firstName || "";
  const lastName  = sellerDoc.lastName  || "";
  return [firstName, lastName].filter(Boolean).join(" ") || sellerDoc.name || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auction-result/auction
// Body: { auction, winner, winningBid }
// Creates a result record. Skips silently if one already exists for this auction.
// ─────────────────────────────────────────────────────────────────────────────
const createAuctionResult = async (req, res) => {
  try {
    const { auction: auctionId, winner: winnerId, winningBid } = req.body;

    if (!auctionId || !winnerId || winningBid === undefined) {
      return res.status(400).json({ message: "auction, winner and winningBid are required" });
    }

    // Avoid duplicates — return existing record if auction already has a result
    const existing = await AuctionResult.findOne({ auction: auctionId });
    if (existing) {
      return res.status(200).json({ message: "Auction result already recorded", data: existing });
    }

    // Fetch winner user doc (need role to resolve display name)
    const winnerDoc = await User.findById(winnerId).lean();

    // Fetch auction as plain object — NO chained .populate() to avoid crashes
    // if the field name doesn't match what's in your AuctionModel
    const auctionDoc = await Auction.findById(auctionId).lean();

    const winnerName   = resolveWinnerName(winnerDoc);
    const auctionTitle = auctionDoc?.title || "";

    // Resolve seller ID — try all common field names used in auction models
    const sellerRef =
      auctionDoc?.seller    ||
      auctionDoc?.createdBy ||
      auctionDoc?.user      ||
      auctionDoc?.postedBy  ||
      null;

    // Seller lookup is best-effort — never let it block result creation
    let sellerName = "";
    if (sellerRef) {
      try {
        const sellerId  = sellerRef?._id || sellerRef;
        const sellerDoc = await User.findById(sellerId)
          .select("firstName lastName name businessName role")
          .lean();
        sellerName = resolveSellerName(sellerDoc);
      } catch (_) {}
    }

    const result = await AuctionResult.create({
      auction: auctionId,
      winner:  winnerId,
      winnerName,
      sellerName,
      auctionTitle,
      winningBid,
    });

    res.status(201).json({ message: "Auction result recorded", data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /auction-result/auctions
// Returns all results with populated refs (admin)
// ─────────────────────────────────────────────────────────────────────────────
const getResults = async (req, res) => {
  try {
    const results = await AuctionResult.find()
      .populate("auction")
      .populate("winner", "firstName lastName name businessName role email");
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /auction-result/auctions/winner/:userId
// Returns all results where winner = userId (used by WonAuctions page)
// ─────────────────────────────────────────────────────────────────────────────
const getResultsByWinner = async (req, res) => {
  try {
    const results = await AuctionResult.find({ winner: req.params.userId })
      .populate("auction")
      .populate("winner", "firstName lastName name businessName role email");
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /auction-result/auction/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteAuctionResult = async (req, res) => {
  try {
    const result = await AuctionResult.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: "Auction result not found" });
    res.status(200).json({ message: "Auction result deleted", data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createAuctionResult,
  getResults,
  getResultsByWinner,
  deleteAuctionResult,
};
