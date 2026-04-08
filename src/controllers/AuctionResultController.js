const AuctionResult = require("../models/AuctionResultModel");
const Auction       = require("../models/AuctionModel");
const User          = require("../models/UserModel");
const Payment       = require("../models/PaymentModel");
const Wallet        = require("../models/WalletModel");

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
// Helper: resolve seller display name from the auction's createdBy user doc
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

    // Fetch auction as plain object
    const auctionDoc = await Auction.findById(auctionId).lean();

    const winnerName   = resolveWinnerName(winnerDoc);
    const auctionTitle = auctionDoc?.title || "";

    // ✅ AuctionModel uses `createdBy` — direct and exact
    const sellerRef = auctionDoc?.createdBy || null;

    // Seller lookup is best-effort — never let it block result creation
    let sellerName = "";
    if (sellerRef) {
      try {
        const sellerDoc = await User.findById(sellerRef)
          .select("firstName lastName name businessName role")
          .lean();
        sellerName = resolveSellerName(sellerDoc);
      } catch (_) {}
    }

    const result = await AuctionResult.create({
      auction:      auctionId,
      winner:       winnerId,
      seller:       sellerRef,   // ✅ store sellerId so payout can be credited later
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
      .populate("winner", "firstName lastName name businessName role email")
      .populate("seller", "firstName lastName name businessName role email");
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
    const winnerId = String(req.params.userId);

    // ✅ seller is now a direct field on AuctionResult — no nested auction populate needed
    // ✅ Only populate auction.createdBy (the one field that actually exists in AuctionModel)
    const rawResults = await AuctionResult.find({ winner: winnerId })
      .populate({
        path: "auction",
        populate: {
          path: "createdBy",
          select: "_id firstName lastName name businessName role",
        },
      })
      .populate("winner",  "firstName lastName name businessName role email")
      .populate("seller",  "_id firstName lastName name businessName role");

    const auctionIds = rawResults
      .map((r) => {
        const aid = r?.auction?._id || r?.auction;
        return aid ? String(aid) : null;
      })
      .filter(Boolean);

    const completedPayments = auctionIds.length
      ? await Payment.find({
          user: winnerId,
          product: { $in: auctionIds },
          paymentStatus: { $in: ["Completed", "Paid"] },
        })
          .select("product paymentMethod razorpayPaymentId createdAt")
          .lean()
      : [];

    const paymentByAuction = new Map();
    for (const p of completedPayments) {
      const aid = p?.product ? String(p.product) : null;
      if (aid && !paymentByAuction.has(aid)) {
        paymentByAuction.set(aid, p);
      }
    }

    const walletDoc = await Wallet.findOne({ userId: winnerId }).select("transactions").lean();
    const walletPaidAuctions = new Set(
      (walletDoc?.transactions || [])
        .filter(
          (tx) =>
            tx &&
            tx.type === "debit" &&
            tx.category === "auction_won" &&
            tx.status === "completed" &&
            tx.referenceId
        )
        .map((tx) => String(tx.referenceId))
    );

    const repairs = [];

    // Attach a top-level sellerId for easy consumption in WonAuctions.jsx
    const results = rawResults.map(r => {
      const obj = r.toObject ? r.toObject() : r;
      const auctionId = obj?.auction?._id ? String(obj.auction._id) : (obj?.auction ? String(obj.auction) : null);

      // ✅ sellerId comes directly from result.seller — no digging through auction
      obj.sellerId = obj.seller?._id
        ? String(obj.seller._id)
        : (obj.seller ? String(obj.seller) : null);

      const alreadyPaid = String(obj.paymentStatus || "").toLowerCase() === "paid";
      const paymentDoc = auctionId ? paymentByAuction.get(auctionId) : null;
      const paidFromWallet = auctionId ? walletPaidAuctions.has(auctionId) : false;
      const inferredPaid = !!paymentDoc || paidFromWallet;

      // Backfill legacy records that were paid before paymentStatus existed on AuctionResult.
      if (!alreadyPaid && inferredPaid) {
        obj.paymentStatus = "Paid";
        obj.paymentMethod = obj.paymentMethod || (paidFromWallet ? "Wallet" : (paymentDoc?.paymentMethod || "Razorpay"));
        obj.paymentId = obj.paymentId || paymentDoc?.razorpayPaymentId || "";
        obj.paidAt = obj.paidAt || paymentDoc?.createdAt || new Date();

        if (obj?._id) {
          repairs.push({
            updateOne: {
              filter: { _id: obj._id },
              update: {
                $set: {
                  paymentStatus: "Paid",
                  paymentMethod: obj.paymentMethod,
                  paymentId: obj.paymentId,
                  paidAt: obj.paidAt,
                },
              },
            },
          });
        }
      }

      return obj;
    });

    if (repairs.length > 0) {
      await AuctionResult.bulkWrite(repairs, { ordered: false });
    }

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
