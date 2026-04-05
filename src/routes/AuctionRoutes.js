const router = require("express").Router();
const auctionController = require("../controllers/AuctionController");

router.post("/auction", auctionController.createAuction);
router.get("/auctions", auctionController.getAuctions);
router.get("/auctions/:id", auctionController.getAuctionById);
router.put("/auction/:id", auctionController.updateAuction);
router.delete("/auction/:id", auctionController.deleteAuction);

module.exports = router;