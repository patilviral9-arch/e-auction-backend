const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    categoryName:{
        type:String,
        required:true
    },
    description:{
        type:String
    },
    status:{
        type: String,
        enum: ['active', 'inactive','deleted','blocked  '],
        default: 'active'
    }
},{
    timestamps:true
})

module.exports = mongoose.model("Category",categorySchema)