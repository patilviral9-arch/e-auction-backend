const Wishlist = require("../models/WishlistModel");

// ── GET /wishlist/:userId ──────────────────────────────────────────────────────
// Get the wishlist for a specific user (populated with full auction details)
const getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.params.userId })
      .populate({
        path: "auctions",
        select: "title category condition location images currentBid startingBid totalBids duration endTime startDate createdAt status createdBy hot",
        populate: {
          path: "createdBy",
          select: "name email businessName",
        },
      });

    if (!wishlist) {
      // Return empty wishlist if none exists yet
      return res.status(200).json({ user: req.params.userId, auctions: [] });
    }

    res.status(200).json(wishlist);
  } catch (err) {
    res.status(500).json({ message: "Error fetching wishlist", error: err.message });
  }
};

// ── POST /wishlist/:userId/add ─────────────────────────────────────────────────
// Add an auction to the user's wishlist (creates wishlist doc if it doesn't exist)
const addToWishlist = async (req, res) => {
  try {
    const { auctionId } = req.body;

    if (!auctionId) {
      return res.status(400).json({ message: "auctionId is required" });
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.params.userId },
      { $addToSet: { auctions: auctionId } }, // $addToSet prevents duplicates
      { new: true, upsert: true }             // upsert creates doc if not found
    ).populate({
      path: "auctions",
      select: "title category condition images currentBid startingBid totalBids duration endTime status",
    });

    res.status(200).json({ message: "Added to wishlist", wishlist });
  } catch (err) {
    res.status(500).json({ message: "Error adding to wishlist", error: err.message });
  }
};

// ── DELETE /wishlist/:userId/remove/:auctionId ────────────────────────────────
// Remove a specific auction from the user's wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.params.userId },
      { $pull: { auctions: req.params.auctionId } },
      { new: true }
    ).populate({
      path: "auctions",
      select: "title category condition images currentBid startingBid totalBids duration endTime status",
    });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    res.status(200).json({ message: "Removed from wishlist", wishlist });
  } catch (err) {
    res.status(500).json({ message: "Error removing from wishlist", error: err.message });
  }
};

// ── DELETE /wishlist/:userId/clear ────────────────────────────────────────────
// Clear all auctions from the user's wishlist
const clearWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.params.userId },
      { $set: { auctions: [] } },
      { new: true }
    );

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    res.status(200).json({ message: "Wishlist cleared", wishlist });
  } catch (err) {
    res.status(500).json({ message: "Error clearing wishlist", error: err.message });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
};
