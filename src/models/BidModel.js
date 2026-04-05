const mongoose = require("mongoose")

const bidSchema = new mongoose.Schema({

    auction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Auction",
        required: true,
    },

    auctionTitle: {
        type: String,
        default: "",
    },

    bidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    userName: {
        type: String,
        default: "",
    },

    bidAmount: {
        type: Number,
        required: true,
    }

}, {
    timestamps: true
})

module.exports = mongoose.model("Bid", bidSchema)