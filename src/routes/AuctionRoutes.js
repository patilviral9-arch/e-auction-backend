const router = require("express").Router();
const auctionController = require("../controllers/AuctionController");

router.post("/auction", auctionController.createAuction);
router.get("/auctions", auctionController.getAuctions);
router.get("/auctions/:id", auctionController.getAuctionById);
router.put("/auction/:id", auctionController.updateAuction);

// ⚠️ This MUST be declared BEFORE DELETE /auction/:id
// Otherwise Express matches "image" as the :id param and calls deleteAuction instead
router.delete("/auction/image", auctionController.deleteCloudinaryImage);
router.delete("/auction/:id", auctionController.deleteAuction);

module.exports = router;