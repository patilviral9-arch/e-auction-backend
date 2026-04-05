const Review = require("../models/ReviewModel");

// ── POST /reviews/:auctionId ───────────────────────────────────────────────────
// Create a new review for an auction
const createReview = async (req, res) => {
  try {
    const { rating, comment, reviewer } = req.body;
    const { auctionId } = req.params;

    // Prevent duplicate review from same user on same auction
    const existing = await Review.findOne({ auction: auctionId, reviewer });
    if (existing) {
      return res.status(400).json({ message: "You have already reviewed this auction." });
    }

    const review = await Review.create({
      auction:  auctionId,
      reviewer: reviewer,
      rating:   Number(rating),
      comment:  comment.trim(),
    });

    const populated = await review.populate("reviewer", "name email businessName");

    res.status(201).json({
      message: "Review submitted successfully",
      review:  populated,
    });
  } catch (err) {
    // Handle duplicate key error (unique index)
    if (err.code === 11000) {
      return res.status(400).json({ message: "You have already reviewed this auction." });
    }
    res.status(500).json({ message: "Error creating review", error: err.message });
  }
};

// ── GET /reviews/:auctionId ────────────────────────────────────────────────────
// Get all reviews for a specific auction
const getReviewsByAuction = async (req, res) => {
  try {
    const reviews = await Review.find({ auction: req.params.auctionId })
      .populate("reviewer", "name email businessName")
      .sort({ createdAt: -1 }); // newest first

    res.status(200).json(reviews);
  } catch (err) {
    res.status(500).json({ message: "Error fetching reviews", error: err.message });
  }
};

// ── GET /reviews ───────────────────────────────────────────────────────────────
// Get all reviews (admin use)
const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("reviewer", "name email businessName")
      .populate("auction",  "title")
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "All reviews fetched", data: reviews });
  } catch (err) {
    res.status(500).json({ message: "Error fetching all reviews", error: err.message });
  }
};

// ── PUT /review/:id ────────────────────────────────────────────────────────────
// Update a review
const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        ...(rating  !== undefined && { rating: Number(rating) }),
        ...(comment !== undefined && { comment: comment.trim() }),
      },
      { new: true, runValidators: true }
    ).populate("reviewer", "name email businessName");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.status(200).json({ message: "Review updated", review });
  } catch (err) {
    res.status(500).json({ message: "Error updating review", error: err.message });
  }
};

// ── DELETE /review/:id ─────────────────────────────────────────────────────────
// Delete a review
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.status(200).json({ message: "Review deleted", data: review });
  } catch (err) {
    res.status(500).json({ message: "Error deleting review", error: err.message });
  }
};

module.exports = {
  createReview,
  getReviewsByAuction,
  getAllReviews,
  updateReview,
  deleteReview,
};
