const Auction = require("../models/AuctionModel");


const deriveStatusAndEndTime = (startDate, durationMinutes) => {
    const now     = new Date();
    const start   = new Date(startDate);
    const endTime = new Date(start.getTime() + Number(durationMinutes) * 60 * 1000);
 
    let status;
    if (endTime <= now)  status = "Completed";
    else if (start > now) status = "Scheduled";
    else                  status = "Active";
 
    return { endTime, status };
};

// CREATE AUCTION
const createAuction = async (req, res) => {
    try {
        const auction = await Auction.create(req.body);

        res.status(201).json({
            message: "Auction created successfully",
            data: auction,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET ALL AUCTIONS
const getAuctions = async (req, res) => {
    try {
        const auctions = await Auction.find().populate("createdBy");

        res.json(auctions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET SINGLE AUCTION
const getAuctionById = async (req, res) => {
    try {
        const auction = await Auction.findById(req.params.id)
            .populate("createdBy");

        res.json(auction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// UPDATE AUCTION
const updateAuction = async (req, res) => {
    try {
        const body = { ...req.body };
 
        // Re-derive endTime and status whenever startDate or durationMinutes changes
        if (body.startDate && body.durationMinutes) {
            const { endTime, status } = deriveStatusAndEndTime(
                body.startDate,
                body.durationMinutes
            );
            body.endTime = endTime;
            body.status  = status;   // recalculate status on edit too
        }
 
        const auction = await Auction.findByIdAndUpdate(
            req.params.id,
            body,
            { new: true }
        );
 
        res.json({
            message: "Auction updated",
            data: auction,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE AUCTION
const deleteAuction = async (req, res) => {
    try {
        await Auction.findByIdAndDelete(req.params.id);

        res.json({
            message: "Auction deleted",
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createAuction,
    getAuctions,
    getAuctionById,
    updateAuction,
    deleteAuction,
};