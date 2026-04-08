const router             = require("express").Router();
const resultController   = require("../controllers/AuctionResultController");

// Create a new auction result (called automatically when a winner is determined)
router.post("/auction", resultController.createAuctionResult);

// List all auction results (admin)
router.get("/auctions", resultController.getResults);

// All results for a specific winner — used by WonAuctions page
router.get("/auctions/winner/:userId", resultController.getResultsByWinner);

// Delete a result (admin)
router.delete("/auction/:id", resultController.deleteAuctionResult);

module.exports = router;
