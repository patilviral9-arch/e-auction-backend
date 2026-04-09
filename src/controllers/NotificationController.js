const Notification = require("../models/NotificationModel");
const Auction = require("../models/AuctionModel");
const Wishlist = require("../models/WishlistModel");

const WINDOW_MS = 20 * 60 * 1000; // 20 minutes
const END_MILESTONES = [3, 2, 1];
const START_MILESTONES = [24, 3, 2, 1];

const buildMessage = (type, auctionTitle) => {
  const title = auctionTitle || "an auction";

  const map = {
    ending_3h: `\"${title}\" is ending in ~3 hours. Place your bid before it is too late.`,
    ending_2h: `\"${title}\" is ending in ~2 hours. Do not miss your chance.`,
    ending_1h: `\"${title}\" is ending in ~1 hour. This is your last chance to bid.`,
    starting_24h: `Your wishlisted scheduled auction \"${title}\" starts in 24 hours.`,
    starting_3h: `\"${title}\" starts in ~3 hours. Get ready to place your bid.`,
    starting_2h: `\"${title}\" starts in ~2 hours. Prepare your bid strategy.`,
    starting_1h: `\"${title}\" starts in ~1 hour. Make sure you are ready.`,
    starting: `\"${title}\" has just started. Place your bid now.`,
    won: `Congratulations. You won \"${title}\". Please complete payment within 24 hours.`,
    outbid: `You have been outbid on \"${title}\" by another user.`,
    lost: `Auction ended. You lost \"${title}\".`,
    payment_success: `Payment successful for \"${title}\".`,
    payment_failed: `Payment failed for \"${title}\". Please retry within 24 hours.`,
    auction_created: `Auction \"${title}\" was created successfully.`,
    reserve_reached: `Good news. Your reserve price has been reached for \"${title}\".`,
    auction_sold: `Auction \"${title}\" sold successfully.`,
    no_bids_or_reserve_not_met: `Auction \"${title}\" ended without sale (no bids or reserve not met).`,
    buyer_completed_payment: `Buyer completed payment for \"${title}\".`,
  };

  return map[type] || `Notification about \"${title}\"`;
};

const createIfNew = async (
  userId,
  auctionId,
  type,
  message,
  auctionResultId = null,
  dedupeSuffix = ""
) => {
  if (!userId || !auctionId || !type) return false;

  const baseKey = `${type}-${String(userId)}-${String(auctionId)}`;
  const dedupeKey = dedupeSuffix ? `${baseKey}-${String(dedupeSuffix)}` : baseKey;

  try {
    await Notification.create({
      userId,
      auctionId,
      type,
      message,
      dedupeKey,
      auctionResultId,
    });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
};

const getAuctionTitle = async (auctionId) => {
  if (!auctionId) return "an auction";
  try {
    const auction = await Auction.findById(auctionId).select("title").lean();
    return auction?.title || "an auction";
  } catch {
    return "an auction";
  }
};

const createAuctionCreatedNotification = async (userId, auctionId) => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(userId, auctionId, "auction_created", buildMessage("auction_created", title));
  } catch (err) {
    console.error("[NotificationController] createAuctionCreatedNotification error:", err.message);
  }
};

const createReserveReachedNotification = async (userId, auctionId) => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(userId, auctionId, "reserve_reached", buildMessage("reserve_reached", title));
  } catch (err) {
    console.error("[NotificationController] createReserveReachedNotification error:", err.message);
  }
};

const createAuctionSoldNotification = async (userId, auctionId) => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(userId, auctionId, "auction_sold", buildMessage("auction_sold", title));
  } catch (err) {
    console.error("[NotificationController] createAuctionSoldNotification error:", err.message);
  }
};

const createNoSaleNotification = async (userId, auctionId) => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(
      userId,
      auctionId,
      "no_bids_or_reserve_not_met",
      buildMessage("no_bids_or_reserve_not_met", title)
    );
  } catch (err) {
    console.error("[NotificationController] createNoSaleNotification error:", err.message);
  }
};

const createWonNotification = async (userId, auctionId, auctionResultId) => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(userId, auctionId, "won", buildMessage("won", title), auctionResultId);
  } catch (err) {
    console.error("[NotificationController] createWonNotification error:", err.message);
  }
};

const createOutbidNotification = async (userId, auctionId, dedupeSuffix = "") => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(
      userId,
      auctionId,
      "outbid",
      buildMessage("outbid", title),
      null,
      dedupeSuffix || Date.now()
    );
  } catch (err) {
    console.error("[NotificationController] createOutbidNotification error:", err.message);
  }
};

const createLostNotification = async (userId, auctionId) => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(userId, auctionId, "lost", buildMessage("lost", title));
  } catch (err) {
    console.error("[NotificationController] createLostNotification error:", err.message);
  }
};

const createPaymentSuccessNotification = async (
  userId,
  auctionId,
  auctionResultId = null,
  dedupeSuffix = ""
) => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(
      userId,
      auctionId,
      "payment_success",
      buildMessage("payment_success", title),
      auctionResultId,
      dedupeSuffix
    );
  } catch (err) {
    console.error("[NotificationController] createPaymentSuccessNotification error:", err.message);
  }
};

const createPaymentFailedNotification = async (userId, auctionId, dedupeSuffix = "") => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(
      userId,
      auctionId,
      "payment_failed",
      buildMessage("payment_failed", title),
      null,
      dedupeSuffix || Date.now()
    );
  } catch (err) {
    console.error("[NotificationController] createPaymentFailedNotification error:", err.message);
  }
};

const createBuyerCompletedPaymentNotification = async (userId, auctionId, dedupeSuffix = "") => {
  try {
    const title = await getAuctionTitle(auctionId);
    await createIfNew(
      userId,
      auctionId,
      "buyer_completed_payment",
      buildMessage("buyer_completed_payment", title),
      null,
      dedupeSuffix
    );
  } catch (err) {
    console.error("[NotificationController] createBuyerCompletedPaymentNotification error:", err.message);
  }
};

const processAuction = async (userId, auction, now, counter) => {
  const start = new Date(auction.startDate).getTime();
  const end = new Date(auction.endTime).getTime();

  if (auction.status === "Active" && end > now) {
    for (const hrs of END_MILESTONES) {
      const milestoneMs = hrs * 60 * 60 * 1000;
      const timeLeft = end - now;
      if (timeLeft >= milestoneMs - WINDOW_MS && timeLeft <= milestoneMs + WINDOW_MS) {
        const ok = await createIfNew(
          userId,
          auction._id,
          `ending_${hrs}h`,
          buildMessage(`ending_${hrs}h`, auction.title)
        );
        if (ok) counter.count += 1;
      }
    }
  }

  if (auction.status === "Scheduled" && start > now) {
    for (const hrs of START_MILESTONES) {
      const milestoneMs = hrs * 60 * 60 * 1000;
      const timeToStart = start - now;
      if (timeToStart >= milestoneMs - WINDOW_MS && timeToStart <= milestoneMs + WINDOW_MS) {
        const ok = await createIfNew(
          userId,
          auction._id,
          `starting_${hrs}h`,
          buildMessage(`starting_${hrs}h`, auction.title)
        );
        if (ok) counter.count += 1;
      }
    }
  }

  if (auction.status === "Active" && now - start >= 0 && now - start < 30 * 60 * 1000) {
    const ok = await createIfNew(userId, auction._id, "starting", buildMessage("starting", auction.title));
    if (ok) counter.count += 1;
  }
};

const generateMilestoneNotifications = async () => {
  const now = Date.now();
  const counter = { count: 0 };

  try {
    const wishlists = await Wishlist.find({}).lean();
    if (!wishlists.length) return;

    const auctionIdSet = new Set();
    for (const wishlist of wishlists) {
      const raw = wishlist.auctions ?? wishlist.auctionId ?? wishlist.auction ?? [];
      const arr = Array.isArray(raw) ? raw : [raw];
      arr.forEach((id) => id && auctionIdSet.add(String(id)));
    }

    if (!auctionIdSet.size) return;

    const auctions = await Auction.find({
      _id: { $in: [...auctionIdSet] },
      status: { $in: ["Active", "Scheduled"] },
    }).lean();

    const auctionMap = {};
    auctions.forEach((auction) => {
      auctionMap[String(auction._id)] = auction;
    });

    for (const wishlist of wishlists) {
      const userId = wishlist.userId ?? wishlist.user;
      if (!userId) continue;

      const raw = wishlist.auctions ?? wishlist.auctionId ?? wishlist.auction ?? [];
      const arr = Array.isArray(raw) ? raw : [raw];

      for (const rawId of arr) {
        if (!rawId) continue;
        const auction = auctionMap[String(rawId)];
        if (!auction) continue;
        await processAuction(userId, auction, now, counter);
      }
    }

    if (counter.count > 0) {
      console.log(`[NotificationController] ${counter.count} new milestone notification(s) created`);
    }
  } catch (err) {
    console.error("[NotificationController] generateMilestoneNotifications error:", err.message);
  }
};

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId })
      .populate("auctionId")
      .populate("auctionResultId")
      .sort({ createdAt: -1 })
      .limit(100);

    const shaped = notifications.map((notification) => ({
      _id: notification._id,
      type: notification.type,
      isRead: notification.isRead,
      body: notification.message,
      message: notification.message,
      createdAt: notification.createdAt,
      auction: notification.auctionId,
      result: notification.auctionResultId,
    }));

    res.json({ notifications: shaped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.params.userId, isRead: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Marked as read", data: notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.params.userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ message: "All marked as read", modified: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const clearAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ userId: req.params.userId });
    res.json({ message: "Cleared", deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  generateMilestoneNotifications,
  createAuctionCreatedNotification,
  createReserveReachedNotification,
  createAuctionSoldNotification,
  createNoSaleNotification,
  createWonNotification,
  createOutbidNotification,
  createLostNotification,
  createPaymentSuccessNotification,
  createPaymentFailedNotification,
  createBuyerCompletedPaymentNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
};

