const Payment = require("../models/PaymentModel")

const makePayment = async(req,res)=>{
    try{

        const payment = await Payment.create(req.body)

        res.status(201).json({
            message:"Payment Successful",
            data:payment
        })

    }catch(err){
        res.status(500).json(err)
    }
}

const getPayments = async(req,res)=>{
    try{

        const payments = await Payment.find()
        .populate("user")
        .populate("product")

        res.json(payments)

    }catch(err){
        res.status(500).json(err)
    }
}

const updatePayment = async(req,res)=>{
    try{
        const payment = await Payment.findByIdAndUpdate(req.params.id,req.body,{new:true})
        res.status(200).json({
            message:"payment updated",
            data : payment
        })
    }catch(err){
        res.status(500).json({
            message:"error while updating payment",
            err:err.message
        })
    }
}

const deletePayment = async(req,res)=>{
    try{
        const payment = await Payment.findByIdAndDelete(req.params.id)
        res.status(200).json({
            message:"payment deleted",
            data : payment
        })
    }catch(err){
        res.status(500).jsom({
            message:"error while deleting payment",
            err:err.message
        })
    }
}
module.exports = {
    makePayment,
    getPayments,
    updatePayment,
    deletePayment
}