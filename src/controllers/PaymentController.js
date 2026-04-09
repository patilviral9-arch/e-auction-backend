const Payment = require("../models/PaymentModel")
const AuctionResult = require("../models/AuctionResultModel")
const Auction = require("../models/AuctionModel")
const Razorpay = require("razorpay")
const crypto = require("crypto")
const {
    createPaymentSuccessNotification,
    createPaymentFailedNotification,
    createBuyerCompletedPaymentNotification,
} = require("./NotificationController")

const getRazorpayConfig = () => {
    const keyId = process.env.RAZORPAY_KEY || process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_SECRET || process.env.RAZORPAY_KEY_SECRET
    return { keyId, keySecret }
}

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
        const { keyId, keySecret } = getRazorpayConfig()

        if (!keyId || !keySecret) {
            return res.status(500).json({
                success: false,
                message: "Razorpay keys are not configured on server",
            })
        }

        const amountRupees = Number(req.body?.amount)
        if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount. Please enter a valid amount.",
            })
        }

        const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
        })

        const options = {
            amount: Math.round(amountRupees * 100),
            currency: "INR",
            // Razorpay requires unique receipt value per order.
            receipt: `wallet_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
        }

        const order = await razorpay.orders.create(options)

        return res.status(201).json({
            success: true,
            key: keyId,
            data: order,
        })
    } catch (err) {
        console.error("Razorpay create-order error:", {
            message: err?.message,
            statusCode: err?.statusCode,
            description: err?.error?.description,
        })

        const statusCode =
            Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 600
                ? err.statusCode
                : 500

        return res.status(statusCode).json({
            success: false,
            message: err?.error?.description || err?.message || "Error while creating Razorpay order",
        })
    }
}

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount,
            user,
            product,
        } = req.body

        const { keySecret } = getRazorpayConfig()
        if (!keySecret) {
            return res.status(500).json({
                success: false,
                message: "Razorpay secret is not configured on server",
            })
        }

        const body = `${razorpay_order_id}|${razorpay_payment_id}`
        const expectedSignature = crypto
            .createHmac("sha256", keySecret)
            .update(body.toString())
            .digest("hex")

        if (expectedSignature === razorpay_signature) {
            await Payment.create({
                user: user || null,
                product: product || null,
                amount: amount || 0,
                paymentMethod: "Razorpay",
                paymentStatus: "Completed",
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
            })

            await markAuctionResultPaid({
                auctionId: product,
                winnerId: user,
                paymentMethod: "Razorpay",
                paymentId: razorpay_payment_id,
            })

            if (user && product) {
                await createPaymentSuccessNotification(
                    user,
                    product,
                    null,
                    razorpay_order_id || razorpay_payment_id
                )

                const soldAuction = await Auction.findById(product).select("createdBy").lean()
                if (soldAuction?.createdBy) {
                    await createBuyerCompletedPaymentNotification(
                        soldAuction.createdBy,
                        product,
                        razorpay_order_id || razorpay_payment_id
                    )
                }
            }

            return res.status(200).json({
                success: true,
                message: "Payment Verified",
            })
        }

        await Payment.create({
            user: user || null,
            product: product || null,
            amount: amount || 0,
            paymentMethod: "Razorpay",
            paymentStatus: "Failed",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        })

        if (user && product) {
            await createPaymentFailedNotification(
                user,
                product,
                razorpay_order_id || razorpay_payment_id
            )
        }

        return res.status(400).json({
            success: false,
            message: "Payment Verification Failed",
        })
    } catch (err) {
        console.error("Razorpay verify-payment error:", err?.message)
        return res.status(500).json({
            success: false,
            message: "Error while verifying payment",
        })
    }
}

const makePayment = async (req, res) => {
    try {
        const payment = await Payment.create(req.body)
        res.status(201).json({
            message: "Payment Successful",
            data: payment,
        })
    } catch (err) {
        res.status(500).json(err)
    }
}

const getPayments = async (req, res) => {
    try {
        const payments = await Payment.find().populate("user").populate("product")
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
            data: payment,
        })
    } catch (err) {
        res.status(500).json({
            message: "error while updating payment",
            err: err.message,
        })
    }
}

const deletePayment = async (req, res) => {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.id)
        res.status(200).json({
            message: "payment deleted",
            data: payment,
        })
    } catch (err) {
        res.status(500).json({
            message: "error while deleting payment",
            err: err.message,
        })
    }
}

module.exports = {
    createRazorpayOrder,
    verifyPayment,
    makePayment,
    getPayments,
    updatePayment,
    deletePayment,
}
