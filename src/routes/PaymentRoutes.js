const router = require("express").Router()
const paymentController = require("../controllers/PaymentController")

router.post("/create-order",paymentController.createRazorpayOrder)
router.post("/verify-payment",paymentController.verifyPayment)
router.post("/payment",paymentController.makePayment)
router.get("/payments",paymentController.getPayments)
router.put("/payment/:id",paymentController.updatePayment)
router.delete("/payment/:id",paymentController.deletePayment)

module.exports = router