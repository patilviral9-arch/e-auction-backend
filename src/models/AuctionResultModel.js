const mongoose = require("mongoose")

const auctionResultSchema = new mongoose.Schema({

    product:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Product"
    },

    winner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },

    winningBid:{
        type:Number
    },

    status:{
        type:String,
        default:"Pending"
    }

},{
    timestamps:true
})

module.exports = mongoose.model("AuctionResult",auctionResultSchema)