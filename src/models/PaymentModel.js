const mongoose = require("mongoose")

const paymentSchema = new mongoose.Schema({

    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },

    product:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Product"
    },

    amount:{
        type:Number
    },

    paymentMethod:{
        type:String
    },

    paymentStatus:{
        type:String,
        default:"Pending"
    }

},{
    timestamps:true
})

module.exports = mongoose.model("Payment",paymentSchema)