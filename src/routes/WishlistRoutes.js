const router = require("express").Router();
const wishlistController = require("../controllers/WishlistController");

// GET    /wishlist/:userId              → get user's full wishlist
// POST   /wishlist/:userId/add          → add auction to wishlist
// DELETE /wishlist/:userId/remove/:auctionId → remove one auction
// DELETE /wishlist/:userId/clear        → clear entire wishlist

router.get("/wishlist/:userId",                          wishlistController.getWishlist);
router.post("/wishlist/:userId/add",                     wishlistController.addToWishlist);
router.delete("/wishlist/:userId/remove/:auctionId",     wishlistController.removeFromWishlist);
router.delete("/wishlist/:userId/clear",                 wishlistController.clearWishlist);

module.exports = router;
