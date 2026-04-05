const router = require("express").Router();
const reviewController = require("../controllers/ReviewController");

// Auction-scoped review routes (matches frontend: /auction/reviews/:auctionId)
router.post("/reviews/:auctionId",reviewController.createReview);
router.get("/reviews/:auctionId", reviewController.getReviewsByAuction);

// Single review routes
router.put("/review/:id", reviewController.updateReview);
router.delete("/review/:id", reviewController.deleteReview);

// Admin — all reviews
router.get("/reviews", reviewController.getAllReviews);

module.exports = router;
