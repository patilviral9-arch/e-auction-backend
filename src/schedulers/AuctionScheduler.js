const cron = require("node-cron");
const Auction       = require("../models/AuctionModel");
const AuctionResult = require("../models/AuctionResultModel");
const User          = require("../models/UserModel");
const { generateMilestoneNotifications } = require("../controllers/NotificationController");
const { releaseDepositsForAuction }      = require("../controllers/WalletController");
const { createWonNotification }          = require("../controllers/NotificationController");

/**
 * Runs every 30 seconds.
 * 1. Scheduled → Active    when current time >= startDate
 * 2. Active    → Completed when current time >= endTime
 *    → Creates AuctionResult (with winnerName, businessName, auctionTitle, paymentStatus)
 *    → Fires "You Won — pay within 24 hours" notification
 *    → Releases security deposits for losing bidders
 * 3. Milestone notifications (3h / 2h / 1h) for wishlisted auctions
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

            // 2. Active → Completed
            const expiredAuctions = await Auction.find({ status: "Active", endTime: { $lte: now } });

            if (expiredAuctions.length > 0) {
                for (const auction of expiredAuctions) {
                    // Mark completed
                    auction.status = "Completed";
                    await auction.save();

                    // ── Determine winner ──────────────────────────────────────────
                    const winnerUserId = auction.winner
                        || auction.highestBidder
                        || auction.winnerId
                        || null;

                    const winningBid = auction.currentBid
                        || auction.highestBid
                        || auction.winningBid
                        || 0;

                    // ── Resolve winner's display names ────────────────────────────
                    let winnerName   = "";
                    let businessName = "";

                    if (winnerUserId) {
                        try {
                            const winnerDoc = await User.findById(winnerUserId).lean();
                            if (winnerDoc) {
                                const first = winnerDoc.firstName || "";
                                const last  = winnerDoc.lastName  || "";
                                winnerName   = [first, last].filter(Boolean).join(" ") || winnerDoc.name || "";
                                businessName = winnerDoc.businessName || "";
                            }
                        } catch (userErr) {
                            console.error(`[Scheduler] ⚠️ Could not fetch winner details:`, userErr.message);
                        }
                    }

                    // ── Create AuctionResult ──────────────────────────────────────
                    let auctionResult = null;
                    if (winnerUserId) {
                        try {
                            // Avoid creating a duplicate if re-run hits the same auction
                            const existing = await AuctionResult.findOne({ auction: auction._id });
                            if (!existing) {
                                auctionResult = await AuctionResult.create({
                                    auction:      auction._id,
                                    product:      auction.product || null,
                                    winner:       winnerUserId,
                                    winnerName,
                                    businessName,
                                    auctionTitle: auction.title || "",
                                    winningBid,
                                    paymentStatus: "Pending",
                                    status:        "Pending",
                                });
                                console.log(`[Scheduler] 🏆 AuctionResult created for "${auction.title}" — winner: ${winnerName || winnerUserId}`);

                                // 🔔 Fire "You Won — pay within 24 hours" notification
                                await createWonNotification(winnerUserId, auction._id, auctionResult._id);
                            }
                        } catch (resultErr) {
                            console.error(`[Scheduler] ❌ AuctionResult creation failed for ${auction._id}:`, resultErr.message);
                        }
                    }

                    // ── Release deposits for losing bidders ───────────────────────
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
