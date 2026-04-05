const router = require("express").Router()
const resultController = require("../controllers/AuctionResultController")

router.post("/auction",resultController.createResult)
router.get("/auctions",resultController.getResults)
router.put("/auction/:id",resultController.updateAuction)
router.delete("/auction/:id",resultController.deleteAuction)

module.exports = router