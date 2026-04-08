const Payment = require("../models/PaymentModel")
const Razorpay = require("razorpay")
const crypto = require("crypto")
 
const createRazorpayOrder = async (req, res) => {
    try {
        // Create instance here so env vars are always read at request time
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

const verifyPayment = async(req,res)=>{

    const {razorpay_order_id,razorpay_payment_id,razorpay_signature} = req.body

    const body = razorpay_order_id + "|" + razorpay_payment_id

    const expectedSignature = crypto.createHmac("sha256",RAZORPAY_SECRET).update(body.toString()).digest("hex")

    if(expectedSignature === razorpay_signature){
        //db entry..
        await bookingSchema.create({
            razorpayOrderId:razorpay_order_id,
            razorpayPaymentId:razorpay_payment_id,
            razorpaySignature:razorpay_signature,
            amount:req.body.amount,
            currency:"INR",
            status:"success",
            bookingId:Math.floor(Math.random()*1000000000000)
        })
        res.status(200).json({
            success:true,
            message:"Payment Verified"
        })
    }else{
        await bookingSchema.create({
            razorpayOrderId:razorpay_order_id,
            razorpayPaymentId:razorpay_payment_id,
            razorpaySignature:razorpay_signature,
            amount:req.body.amount,
            currency:"INR",
            status:"failed",
            bookingId:Math.floor(Math.random()*1000000000000)
        })  
        res.status(400).json({
            success:false,
            message:"Payment Verification Failed"
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