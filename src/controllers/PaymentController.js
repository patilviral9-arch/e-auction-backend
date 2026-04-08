const Payment = require("../models/PaymentModel")
const AuctionResult = require("../models/AuctionResultModel")
const Razorpay = require("razorpay")
const crypto = require("crypto")

const markAuctionResultPaid = async ({ auctionId, winnerId, paymentMethod, paymentId }) => {
    if (!auctionId || !winnerId) return
    try {
        await AuctionResult.findOneAndUpdate(
            { auction: auctionId, winner: winnerId },
            {
                $set: {
                    paymentStatus: "Paid",
                    paymentMethod: paymentMethod || "",
                    paymentId: paymentId || "",
                    paidAt: new Date(),
                },
            },
            { new: true }
        )
    } catch (err) {
        console.error("markAuctionResultPaid error:", err.message)
    }
}
 
const createRazorpayOrder = async (req, res) => {
    try {
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY,
            key_secret: process.env.RAZORPAY_SECRET,
        })
 
        const options = {
            amount: Number(req.body.amount) * 100,
            currency: "INR",
            receipt: "receipt_order_id",
            payment_capture: 1
        }
 
        const order = await razorpay.orders.create(options)
 
        res.status(201).json({
            success: true,
            key: process.env.RAZORPAY_KEY,
            data: order
        })
    } catch (err) {
        console.error("Razorpay error:", err)
        res.status(500).json({
            success: false,
            message: "Error while creating Razorpay order",
            error: err.message
        })
    }
}

const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, user, product } = req.body

    const body = razorpay_order_id + "|" + razorpay_payment_id

    // ✅ Fixed: use process.env.RAZORPAY_SECRET (was bare variable before)
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET)
        .update(body.toString())
        .digest("hex")

    if (expectedSignature === razorpay_signature) {
        // ✅ Fixed: use Payment model instead of undefined bookingSchema
        await Payment.create({
            user:              user   || null,
            product:           product || null,
            amount:            amount  || 0,
            paymentMethod:     "Razorpay",
            paymentStatus:     "Completed",
            razorpayOrderId:   razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        })

        await markAuctionResultPaid({
            auctionId: product,
            winnerId: user,
            paymentMethod: "Razorpay",
            paymentId: razorpay_payment_id,
        })

        res.status(200).json({
            success: true,
            message: "Payment Verified"
        })
    } else {
        // ✅ Also store failed payments for audit trail
        await Payment.create({
            user:              user   || null,
            product:           product || null,
            amount:            amount  || 0,
            paymentMethod:     "Razorpay",
            paymentStatus:     "Failed",
            razorpayOrderId:   razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        })
        res.status(400).json({
            success: false,
            message: "Payment Verification Failed"
        })
    }
}
 
const makePayment = async (req, res) => {
    try {
        const payment = await Payment.create(req.body)
        res.status(201).json({
            message: "Payment Successful",
            data: payment
        })
    } catch (err) {
        res.status(500).json(err)
    }
}
 
const getPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate("user")
            .populate("product")
        res.json(payments)
    } catch (err) {
        res.status(500).json(err)
    }
}
 
const updatePayment = async (req, res) => {
    try {
        const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true })
        res.status(200).json({
            message: "payment updated",
            data: payment
        })
    } catch (err) {
        res.status(500).json({
            message: "error while updating payment",
            err: err.message
        })
    }
}
 
const deletePayment = async (req, res) => {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.id)
        res.status(200).json({
            message: "payment deleted",
            data: payment
        })
    } catch (err) {
        res.status(500).json({
            message: "error while deleting payment",
            err: err.message
        })
    }
}
 
module.exports = {
    createRazorpayOrder,
    verifyPayment,
    makePayment,
    getPayments,
    updatePayment,
    deletePayment
}
