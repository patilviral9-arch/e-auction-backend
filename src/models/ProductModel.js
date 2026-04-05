const mongoose = require("mongoose")

const productSchema = new mongoose.Schema({

    productName:{
        type:String,
        required:true
    },

    description:{
        type:String
    },

    basePrice:{
        type:Number,
        required:true
    },

    category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Category"
    },

    seller:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },

    image:{
        type:String
    },

    auctionStart:{
        type:Date
    },

    auctionEnd:{
        type:Date
    }

},{
    timestamps:true
})

module.exports = mongoose.model("Product",productSchema)