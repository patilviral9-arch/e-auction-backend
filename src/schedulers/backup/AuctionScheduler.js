const cron = require("node-cron");
const Auction = require("../models/AuctionModel");
const { generateMilestoneNotifications } = require("../controllers/NotificationController");
const { releaseDepositsForAuction }      = require("../controllers/WalletController");

/**
 * Runs every 30 seconds.
 * 1. Scheduled → Active    when current time >= startDate
 * 2. Active    → Completed when current time >= endTime
 * 3. Generates milestone notifications (3h / 2h / 1h) for wishlisted auctions
 */
const startAuctionScheduler = () => {
    cron.schedule("*/30 * * * * *", async () => {
        const now = new Date();
        try {
            // 1. Scheduled → Active
            const activatedResult = await Auction.updateMany(
                { status: "Scheduled", startDate: { $lte: now } },
                { $set: { status: "Active" } }
            );
            if (activatedResult.modifiedCount > 0)
                console.log(`[Scheduler] ✅ ${activatedResult.modifiedCount} auction(s) → Active`);

            // 2. Active → Completed + release all security deposits
            const expiredAuctions = await Auction.find({ status: "Active", endTime: { $lte: now } });

            if (expiredAuctions.length > 0) {
                for (const auction of expiredAuctions) {
                    // Mark completed
                    auction.status = "Completed";
                    await auction.save();

                    // Determine winner (highest bid — stored on auction or derived)
                    // winner field names may vary; adjust to match your AuctionModel
                    const winnerUserId = auction.winner
                        || auction.highestBidder
                        || auction.winnerId
                        || null;

                    // Release deposits for everyone except the winner
                    try {
                        const released = await releaseDepositsForAuction({
                            auctionId:    String(auction._id),
                            winnerUserId: winnerUserId ? String(winnerUserId) : null,
                            auctionTitle: auction.title || "auction",
                        });
                        if (released.length > 0)
                            console.log(`[Scheduler] 🔓 Released deposits for ${released.length} bidder(s) on "${auction.title}"`);
                    } catch (depErr) {
                        console.error(`[Scheduler] ❌ Deposit release failed for auction ${auction._id}:`, depErr.message);
                    }
                }
                console.log(`[Scheduler] 🏁 ${expiredAuctions.length} auction(s) → Completed`);
            }

            // 3. Generate milestone notifications for all wishlisted auctions
            await generateMilestoneNotifications();

        } catch (err) {
            console.error("[Scheduler] ❌ Error:", err.message);
        }
    });

    console.log("[Scheduler] 🕒 Auction scheduler started (runs every 30s)");
};

module.exports = { startAuctionScheduler };
