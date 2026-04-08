const router = require("express").Router()
const bidController = require("../controllers/BidController")


router.post("/bid",                        bidController.placeBid)
router.get("/bids",                        bidController.getBids)
router.get("/bids/auction/:auctionId",     bidController.getBidsByAuction)
router.get("/bids/bidder/:userId",         bidController.getBidsByBidder)
router.put("/bid/:id",                     bidController.updateBid)
router.delete("/bid/:id",                  bidController.deleteBid)
router.delete("/bids/auction/:auctionId",     bidController.deleteBid)

module.exports = router
