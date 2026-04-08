const mongoose = require("mongoose")

const paymentSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },

    amount: {
        type: Number
    },

    paymentMethod: {
        type: String
    },

    paymentStatus: {
        type: String,
        default: "Pending"
    },

    // ✅ Added: Razorpay-specific fields for verify-payment storage
    razorpayOrderId: {
        type: String
    },

    razorpayPaymentId: {
        type: String
    },

    razorpaySignature: {
        type: String
    }

}, {
    timestamps: true
})

module.exports = mongoose.model("Payment", paymentSchema)
