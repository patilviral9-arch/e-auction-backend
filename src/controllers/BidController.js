const Bid = require("../models/BidModel")
const Auction = require("../models/Auctionmodel")
const {
    createOutbidNotification,
    createReserveReachedNotification,
} = require("./NotificationController")

const placeBid = async (req, res) => {
    try {
        const { auction, bidder, bidAmount, auctionTitle, userName } = req.body

        if (!auction || !bidder || !bidAmount) {
            return res.status(400).json({ message: "auction, bidder and bidAmount are required." })
        }

        // Verify auction exists
        const foundAuction = await Auction.findById(auction)
        if (!foundAuction) {
            return res.status(404).json({ message: "Auction not found." })
        }

        // Bid must be higher than current highest bid
        const highestBid = await Bid.findOne({ auction }).sort({ bidAmount: -1 })
        const currentHighest = highestBid ? highestBid.bidAmount : foundAuction.startingBid
        const previousHighestBidder = highestBid?.bidder ? String(highestBid.bidder) : null
        const reservePrice = Number(foundAuction.reservePrice || 0)
        const reserveWasMet = reservePrice > 0 && Number(currentHighest) >= reservePrice
        const reserveNowMet = reservePrice > 0 && Number(bidAmount) >= reservePrice && !reserveWasMet

        if (bidAmount <= currentHighest) {
            return res.status(400).json({
                message: `Bid must be higher than current bid of ₹${currentHighest}.`
            })
        }

        // Resolve auctionTitle from DB if not provided by client
        const resolvedAuctionTitle = auctionTitle || foundAuction.title || ""

        const bid = await Bid.create({
            auction,
            auctionTitle: resolvedAuctionTitle,
            bidder,
            userName: userName || "",
            bidAmount,
        })

        const populated = await bid.populate([
            { path: "bidder", select: "firstName lastName businessName email role" },
            { path: "auction", select: "title category startingBid status" }
        ])

        // Resolve userName from populated bidder if client didn't send it
        if (!populated.userName) {
            const u = populated.bidder
            populated.userName = u.businessName
                ? u.businessName
                : ((u.firstName || "") + " " + (u.lastName || "")).trim() || u.email || ""
            await Bid.findByIdAndUpdate(bid._id, { userName: populated.userName })
        }

        // Notify the previous top bidder that they were outbid.
        if (previousHighestBidder && previousHighestBidder !== String(bidder)) {
            await createOutbidNotification(previousHighestBidder, foundAuction._id, bid._id)
        }

        // Notify seller when reserve price is reached for the first time.
        if (reserveNowMet && foundAuction?.createdBy) {
            await createReserveReachedNotification(foundAuction.createdBy, foundAuction._id)
        }

        res.status(201).json({
            message: "Bid placed successfully.",
            data: populated
        })

    } catch (err) {
        res.status(500).json({ message: "Error placing bid.", err: err.message })
    }
}

const getBids = async (req, res) => {
    try {
        const bids = await Bid.find()
            .populate("bidder", "firstName lastName businessName email role")
            .populate("auction", "title category startingBid status")
            .sort({ createdAt: -1 })

        res.status(200).json({
            message: "All bids retrieved.",
            data: bids
        })
    } catch (err) {
        res.status(500).json({ message: "Error getting all bids.", err: err.message })
    }
}

// Get all bids for a specific auction
const getBidsByAuction = async (req, res) => {
    try {
        const bids = await Bid.find({ auction: req.params.auctionId })
            .populate("bidder", "firstName lastName businessName email role")
            .populate("auction", "title category startingBid status")
            .sort({ bidAmount: -1 })  // highest bid first

        res.status(200).json({
            message: "Bids for auction retrieved.",
            data: bids
        })
    } catch (err) {
        res.status(500).json({ message: "Error getting bids for auction.", err: err.message })
    }
}

const updateBid = async (req, res) => {
    try {
        const bid = await Bid.findByIdAndUpdate(req.params.id, req.body, { new: true })
        res.status(200).json({ message: "Bid updated.", data: bid })
    } catch (err) {
        res.status(500).json({ message: "Error while updating bid.", err: err.message })
    }
}

const deleteBid = async (req, res) => {
    try {
        const bid = await Bid.findByIdAndDelete(req.params.id)
        res.status(200).json({ message: "Bid deleted.", data: bid })
    } catch (err) {
        res.status(500).json({ message: "Error while deleting bid.", err: err.message })
    }
}

// ── DELETE all bids for an auction (called when auction is edited) ─────────────
const deleteByAuction = async (req, res) => {
    try {
        const result = await Bid.deleteMany({ auction: req.params.auctionId })
        console.log(`[deleteByAuction] auctionId=${req.params.auctionId} deleted=${result.deletedCount}`)
        res.status(200).json({ message: "All bids for auction deleted.", deletedCount: result.deletedCount })
    } catch (err) {
        res.status(500).json({ message: "Error deleting bids for auction.", err: err.message })
    }
}

// Get all bids placed by a specific bidder (user)
const getBidsByBidder = async (req, res) => {
    try {
        const bids = await Bid.find({ bidder: req.params.userId })
            .populate({
                path: 'auction',
                select: 'title category condition status images currentBid startingBid totalBids createdBy endTime startDate duration durationMinutes',
                populate: { path: 'createdBy', select: 'firstName lastName businessName email' }
            })
            .sort({ createdAt: -1 })

        res.status(200).json({
            message: 'Bids for bidder retrieved.',
            data: bids
        })
    } catch (err) {
        res.status(500).json({ message: 'Error getting bids for bidder.', err: err.message })
    }
}

module.exports = {
    placeBid,
    getBids,
    getBidsByAuction,
    updateBid,
    deleteBid,
    deleteByAuction,
    getBidsByBidder
}
