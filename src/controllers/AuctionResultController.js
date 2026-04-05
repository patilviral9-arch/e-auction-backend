const AuctionResult = require("../models/AuctionResultModel")
const { createWonNotification } = require("../controllers/NotificationController");

const createAuctionResult = async (req, res) => {
    try {
        const result = await AuctionResult.create(req.body);
 
        // 🔔 Fire the "You Won" notification for the winner
        if (result.winner && result.auction) {
            await createWonNotification(result.winner, result.auction, result._id);
        }
 
        res.status(201).json({ message: "Auction result recorded", data: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createResult = async(req,res)=>{
    try{

        const result = await AuctionResult.create(req.body)

        res.status(201).json({
            message:"Auction Result Created",
            data:result
        })

    }catch(err){
        res.status(500).json(err)
    }
}

const getResults = async(req,res)=>{
    try{

        const results = await AuctionResult.find()
        .populate("product")
        .populate("winner")

        res.json(results)

    }catch(err){
        res.status(500).json(err)
    }
}

const updateAuction = async(req,res)=>{
    try{
        const auction = await AuctionResult.findByIdAndUpdate(req.params.id,req.body,{new:true})
        res.status(200).json({
            message:"auction updated",
            data : auction
        })
    }catch(err){
        res.status(500).json({
            message:"error while updating auction",
            err:err.message
        })
    }
}

const deleteAuction = async(req,res)=>{
    try{
        const auction = await AuctionResult.findByIdAndDelete(req.params.id)
        res.status(200).json({
            message:"auction deleted",
            data : auction
        })
    }catch(err){
        res.status(500).jsom({
            message:"error while deleting auction",
            err:err.message
        })
    }
}

module.exports = {
    createResult,
    getResults,
    updateAuction,
    deleteAuction
}