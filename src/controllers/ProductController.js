const Product = require("../models/ProductModel")

const createProduct = async(req,res)=>{
    try{

        const product = await Product.create(req.body)

        res.status(201).json({
            message:"Product Created",
            data:product
        })

    }catch(err){
        res.status(500).json(err)
    }
}

const getAllProducts = async(req,res)=>{
    try{

        const products = await Product.find()
        
       .populate("category","categoryName")
      .populate("seller","businessName")

        res.json(products)

    }catch(err){
        res.status(500).json(err)
    }
}

const updateproduct = async(req,res)=>{
    try{
        console.log("Headers:", req.headers['content-type']);
        const product = await Product.findByIdAndUpdate(req.params.id,req.body,{new:true})
        res.status(200).json({
            message:"product updated",
            data: product
        })
    }catch(err){
        res.status(500).json({
            message:"error while updating product",
            err:err.message
        })
    }
}

const deleteproduct = async(req,res)=>{
    try{
        const product = await Product.findByIdAndDelete(req.params.id)
        res.status(200).json({
            message:"product is deleted!!",
            data:product
        })
    }catch(err){
        res.status(500).json({
            message:"error while deleting product",
            err:err.message
        })
    }
}

module.exports = {
    createProduct,
    getAllProducts,
    updateproduct,
    deleteproduct
}