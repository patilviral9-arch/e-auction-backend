const Auction    = require("../models/AuctionModel");
const cloudinary = require("cloudinary").v2;
const { createAuctionCreatedNotification } = require("./NotificationController");

// Configure Cloudinary from environment variables.
// Make sure your .env has:
//   CLOUDINARY_CLOUD_NAME=df7qog24u
//   CLOUDINARY_API_KEY=<your key>
//   CLOUDINARY_API_SECRET=<your secret>
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Extract the Cloudinary public_id from a secure_url.
 *  e.g. "https://res.cloudinary.com/mycloud/image/upload/v1234/folder/abc123.jpg"
 *       → "folder/abc123"
 */
const publicIdFromUrl = (url) => {
  try {
    // Grab everything after "/upload/v<digits>/" and strip the file extension
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/** Delete a single image from Cloudinary by public_id (server-side, signed). */
const deleteCloudinaryImage = async (req, res) => {
  const { public_id } = req.body;
  if (!public_id) return res.status(400).json({ error: "public_id is required" });
  try {
    console.log(`🗑️  Deleting Cloudinary image: ${public_id}`);
    const result = await cloudinary.uploader.destroy(public_id);
    console.log(`✅ Cloudinary destroy result:`, result);
    // result.result === "ok" means deleted, "not found" means already gone
    res.json({ result });
  } catch (err) {
    console.error(`❌ Cloudinary delete error for ${public_id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
};


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

        // Notify business seller that auction creation succeeded.
        if (auction?.createdBy) {
            await createAuctionCreatedNotification(auction.createdBy, auction._id);
        }

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

// DELETE AUCTION  (also removes all images from Cloudinary)
const deleteAuction = async (req, res) => {
    try {
        const auction = await Auction.findById(req.params.id);
        if (!auction) return res.status(404).json({ error: "Auction not found" });

        // Delete every image from Cloudinary before removing the DB record
        if (Array.isArray(auction.images) && auction.images.length > 0) {
            const deletePromises = auction.images.map(async (img) => {
                const url = typeof img === "string" ? img : img.url || img.secure_url || "";
                const public_id = publicIdFromUrl(url);
                if (!public_id) return;
                try {
                    await cloudinary.uploader.destroy(public_id);
                } catch (cloudErr) {
                    // Non-fatal — log and continue so the DB record is still deleted
                    console.warn(`⚠️  Could not delete Cloudinary image ${public_id}:`, cloudErr.message);
                }
            });
            await Promise.all(deletePromises);
        }

        await Auction.findByIdAndDelete(req.params.id);

        res.json({ message: "Auction deleted" });
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
    deleteCloudinaryImage,
};
