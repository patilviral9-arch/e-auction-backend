const cron = require("node-cron");
const Auction = require("../models/AuctionModel");

/**
 * Runs every 30 seconds.
 * 1. Scheduled → Active   : when current time >= startDate
 * 2. Active    → Completed : when current time >= endTime
 */
const startAuctionScheduler = () => {
    cron.schedule("*/30 * * * * *", async () => {
        const now = new Date();

        try {
            // ── 1. Scheduled → Active ─────────────────────────────────────────
            const activatedResult = await Auction.updateMany(
                {
                    status: "Scheduled",
                    startDate: { $lte: now },
                },
                { $set: { status: "Active" } }
            );

            if (activatedResult.modifiedCount > 0) {
                console.log(
                    `[Scheduler] ✅ ${activatedResult.modifiedCount} auction(s) moved Scheduled → Active`
                );
            }

            // ── 2. Active → Completed ─────────────────────────────────────────
            const completedResult = await Auction.updateMany(
                {
                    status: "Active",
                    endTime: { $lte: now },
                },
                { $set: { status: "Completed" } }
            );

            if (completedResult.modifiedCount > 0) {
                console.log(
                    `[Scheduler] 🏁 ${completedResult.modifiedCount} auction(s) moved Active → Completed`
                );
            }
        } catch (err) {
            console.error("[Scheduler] ❌ Error updating auction statuses:", err.message);
        }
    });

    console.log("[Scheduler] 🕒 Auction status scheduler started (runs every 30s)");
};

module.exports = { startAuctionScheduler };
