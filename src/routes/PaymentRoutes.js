const router = require("express").Router()
const paymentController = require("../controllers/PaymentController")

router.post("/payment",paymentController.makePayment)
router.get("/payments",paymentController.getPayments)
router.put("/payment/:id",paymentController.updatePayment)
router.delete("/payment/:id",paymentController.deletePayment)

module.exports = router