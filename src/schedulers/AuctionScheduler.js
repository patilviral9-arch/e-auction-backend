const cron = require("node-cron");
const Auction = require("../models/AuctionModel");
const AuctionResult = require("../models/AuctionResultModel");
const Bid = require("../models/BidModel");
const User = require("../models/UserModel");
const {
  generateMilestoneNotifications,
  createWonNotification,
  createLostNotification,
  createAuctionSoldNotification,
  createNoSaleNotification,
} = require("../controllers/NotificationController");
const { releaseDepositsForAuction } = require("../controllers/WalletController");

const resolveUserName = (userDoc) => {
  if (!userDoc) return "";
  const role = String(userDoc.role || "").toLowerCase();
  if (role === "business") return userDoc.businessName || userDoc.name || "";
  const first = userDoc.firstName || "";
  const last = userDoc.lastName || "";
  return [first, last].filter(Boolean).join(" ") || userDoc.name || "";
};

const startAuctionScheduler = () => {
  cron.schedule("*/30 * * * * *", async () => {
    const now = new Date();

    try {
      const activatedResult = await Auction.updateMany(
        { status: "Scheduled", startDate: { $lte: now } },
        { $set: { status: "Active" } }
      );
      if (activatedResult.modifiedCount > 0) {
        console.log(`[Scheduler] ${activatedResult.modifiedCount} auction(s) moved to Active`);
      }

      const expiredAuctions = await Auction.find({ status: "Active", endTime: { $lte: now } });

      for (const auction of expiredAuctions) {
        try {
          auction.status = "Completed";
          await auction.save();

          const topBid = await Bid.findOne({ auction: auction._id })
            .sort({ bidAmount: -1, createdAt: 1 })
            .lean();

          const winnerUserId = topBid?.bidder ? String(topBid.bidder) : null;
          const winningBid = Number(topBid?.bidAmount || 0);
          const reservePrice = Number(auction.reservePrice || 0);
          const reserveMet = reservePrice <= 0 || winningBid >= reservePrice;
          const sellerUserId = auction.createdBy ? String(auction.createdBy) : null;
          const isSold = !!winnerUserId && reserveMet;

          if (isSold) {
            const winnerDoc = await User.findById(winnerUserId)
              .select("firstName lastName name businessName role")
              .lean();
            const sellerDoc = sellerUserId
              ? await User.findById(sellerUserId)
                  .select("firstName lastName name businessName role")
                  .lean()
              : null;

            const winnerName = resolveUserName(winnerDoc);
            const sellerName = resolveUserName(sellerDoc);

            let auctionResult = await AuctionResult.findOne({ auction: auction._id });
            if (!auctionResult) {
              auctionResult = await AuctionResult.create({
                auction: auction._id,
                winner: winnerUserId,
                seller: sellerUserId || null,
                winnerName,
                sellerName,
                auctionTitle: auction.title || "",
                winningBid,
                paymentStatus: "Pending",
              });
            }

            await createWonNotification(winnerUserId, auction._id, auctionResult._id);

            if (sellerUserId) {
              await createAuctionSoldNotification(sellerUserId, auction._id);
            }

            const bidderIds = await Bid.distinct("bidder", { auction: auction._id });
            for (const bidderId of bidderIds) {
              const id = String(bidderId);
              if (!id || id === winnerUserId) continue;
              await createLostNotification(id, auction._id);
            }

            await releaseDepositsForAuction({
              auctionId: String(auction._id),
              winnerUserId,
              auctionTitle: auction.title || "auction",
            });
          } else {
            if (sellerUserId) {
              await createNoSaleNotification(sellerUserId, auction._id);
            }

            await releaseDepositsForAuction({
              auctionId: String(auction._id),
              winnerUserId: null,
              auctionTitle: auction.title || "auction",
            });
          }
        } catch (auctionErr) {
          console.error(`[Scheduler] Failed processing auction ${auction?._id}:`, auctionErr.message);
        }
      }

      if (expiredAuctions.length > 0) {
        console.log(`[Scheduler] ${expiredAuctions.length} auction(s) moved to Completed`);
      }

      await generateMilestoneNotifications();
    } catch (err) {
      console.error("[Scheduler] Error:", err.message);
    }
  });

  console.log("[Scheduler] Auction scheduler started (runs every 30s)");
};

module.exports = { startAuctionScheduler };

