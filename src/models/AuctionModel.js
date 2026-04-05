const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema(
{
    title: {
        type: String,
        required: true,
    },

    category: {
        type: String,
        required: true,
    },

    condition: {
        type: String,
        required: true,
    },

    location: {
        type: String,
        required: true,
    },

    tags: [
        {
            type: String,
        }
    ],

    description: {
        type: String,
        required: true,
    },

    startingBid: {
        type: Number,
        required: true,
    },

    reservePrice: {
        type: Number,
    },

    minBidIncrement: {
        type: Number,
        default: 100,
    },

    duration: {
        type: String, 
        required: true,
    },

    durationMinutes: {
        type: Number, 
    },

    startDate: {
        type: Date, 
    },

    scheduledAt: {
        type: Date,  
    },
 
    endTime: {
        type: Date, 
    },

    status: {
        type: String,
        enum: ["Active", "Scheduled", "Completed", "Cancelled"],
        default: "Active",
    },

    images: {
        type: [String],
        default: [],
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }
},
{
    timestamps: true,
});

module.exports = mongoose.models.Auction || mongoose.model("Auction", auctionSchema);