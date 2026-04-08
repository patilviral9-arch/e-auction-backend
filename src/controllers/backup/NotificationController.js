const Notification = require("../models/NotificationModel");
const AuctionResult = require("../models/AuctionResultModel");
const Auction       = require("../models/AuctionModel"); // adjust path if needed
const Wishlist      = require("../models/WishlistModel")

// ── Milestone config ──────────────────────────────────────────────────────────
const WINDOW_MS        = 20 * 60 * 1000; // 20-min window around each milestone
const END_MILESTONES   = [3, 2, 1];      // hours before endTime
const START_MILESTONES = [3, 2, 1];      // hours before startDate

// ── Message templates ─────────────────────────────────────────────────────────
const buildMessage = (type, auctionTitle) => {
    const t = auctionTitle || "an auction";
    const map = {
        ending_3h:   `⏳ "${t}" is ending in ~3 hours! Place your bid before it's too late.`,
        ending_2h:   `🔥 "${t}" is ending in ~2 hours! Don't miss your chance.`,
        ending_1h:   `🚨 "${t}" is ending in ~1 hour! This is your last chance to bid.`,
        starting_3h: `📅 "${t}" starts in ~3 hours. Get ready to place your bid!`,
        starting_2h: `🔔 "${t}" starts in ~2 hours. Prepare your bid strategy!`,
        starting_1h: `🟢 "${t}" is starting in ~1 hour! Make sure you're ready.`,
        starting:    `🟢 "${t}" has just started! Place your bid now.`,
        won:         `🏆 Congratulations! You won "${t}". Please complete your payment within 24 hours to secure your item.`,
    };
    return map[type] || `Notification about "${t}"`;
};

// ── Safely create — skip silently if dedupeKey already exists ─────────────────
const createIfNew = async (userId, auctionId, type, message, auctionResultId = null) => {
    const dedupeKey = `${type}-${String(userId)}-${String(auctionId)}`;
    try {
        await Notification.create({ userId, auctionId, type, message, dedupeKey, auctionResultId });
        return true;
    } catch (err) {
        if (err.code === 11000) return false; // duplicate — already sent, skip
        throw err;
    }
};

// ── Check milestones for one auction + one user ───────────────────────────────
const processAuction = async (userId, auction, now, counter) => {
    const start = new Date(auction.startDate).getTime();
    const end   = new Date(auction.endTime).getTime();

    // ENDING milestones — only when Active and not yet ended
    if (auction.status === "Active" && end > now) {
        for (const hrs of END_MILESTONES) {
            const milestoneMs = hrs * 60 * 60 * 1000;
            const timeLeft    = end - now;
            if (timeLeft >= milestoneMs - WINDOW_MS && timeLeft <= milestoneMs + WINDOW_MS) {
                const ok = await createIfNew(userId, auction._id, `ending_${hrs}h`, buildMessage(`ending_${hrs}h`, auction.title));
                if (ok) counter.count++;
            }
        }
    }

    // STARTING milestones — only when Scheduled and not yet started
    if (auction.status === "Scheduled" && start > now) {
        for (const hrs of START_MILESTONES) {
            const milestoneMs = hrs * 60 * 60 * 1000;
            const timeToStart = start - now;
            if (timeToStart >= milestoneMs - WINDOW_MS && timeToStart <= milestoneMs + WINDOW_MS) {
                const ok = await createIfNew(userId, auction._id, `starting_${hrs}h`, buildMessage(`starting_${hrs}h`, auction.title));
                if (ok) counter.count++;
            }
        }
    }

    // JUST STARTED — fired once within 30 min of startDate
    if (auction.status === "Active" && now - start >= 0 && now - start < 30 * 60 * 1000) {
        const ok = await createIfNew(userId, auction._id, "starting", buildMessage("starting", auction.title));
        if (ok) counter.count++;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEDULER HOOK — called by AuctionScheduler every 30s
// ═══════════════════════════════════════════════════════════════════════════════
const generateMilestoneNotifications = async () => {
    const now     = Date.now();
    const counter = { count: 0 };

    try {
        // Step 1 — get all wishlist docs as plain objects (no populate)
        const wishlists = await Wishlist.find({}).lean();

        if (!wishlists.length) return;

        // Step 2 — collect every unique auctionId across all wishlists
        // Handles both: { auctions: [ObjectId] }  and  { auctionId: ObjectId }
        const auctionIdSet = new Set();
        for (const w of wishlists) {
            const raw = w.auctions ?? w.auctionId ?? w.auction ?? [];
            const arr = Array.isArray(raw) ? raw : [raw];
            arr.forEach(id => id && auctionIdSet.add(String(id)));
        }

        if (!auctionIdSet.size) return;

        // Step 3 — fetch only Active/Scheduled auctions in one DB call
        const auctions = await Auction.find({
            _id:    { $in: [...auctionIdSet] },
            status: { $in: ["Active", "Scheduled"] },
        }).lean();

        // Build quick lookup map
        const auctionMap = {};
        auctions.forEach(a => { auctionMap[String(a._id)] = a; });

        // Step 4 — for each wishlist user, process each of their auctions
        for (const w of wishlists) {
            // Support both "userId" and "user" field name
            const userId = w.userId ?? w.user;
            if (!userId) continue;

            const raw = w.auctions ?? w.auctionId ?? w.auction ?? [];
            const arr = Array.isArray(raw) ? raw : [raw];

            for (const rawId of arr) {
                if (!rawId) continue;
                const auction = auctionMap[String(rawId)];
                if (!auction) continue; // Completed/Cancelled — skip
                await processAuction(userId, auction, now, counter);
            }
        }

        if (counter.count > 0) {
            console.log(`[NotificationController] 🔔 ${counter.count} new notification(s) created`);
        }

    } catch (err) {
        console.error("[NotificationController] ❌ generateMilestoneNotifications error:", err.message);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  WON NOTIFICATION — call from AuctionResultController when winner is saved
// ═══════════════════════════════════════════════════════════════════════════════
const createWonNotification = async (userId, auctionId, auctionResultId) => {
    try {
        const auction = await Auction.findById(auctionId).lean();
        await createIfNew(userId, auctionId, "won", buildMessage("won", auction?.title), auctionResultId);
        console.log(`[NotificationController] 🏆 Won notification → user ${userId}`);
    } catch (err) {
        console.error("[NotificationController] ❌ createWonNotification error:", err.message);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  REST ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /notification/:userId
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.params.userId })
            .populate("auctionId")
            .populate("auctionResultId")
            .sort({ createdAt: -1 })
            .limit(100);

        const shaped = notifications.map(n => ({
            _id:       n._id,
            type:      n.type,
            isRead:    n.isRead,
            message:   n.message,
            createdAt: n.createdAt,
            auction:   n.auctionId,
            result:    n.auctionResultId,
        }));

        res.json({ notifications: shaped });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /notification/:userId/unread-count
const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ userId: req.params.userId, isRead: false });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /notification/:id/read
const markAsRead = async (req, res) => {
    try {
        const n = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
        if (!n) return res.status(404).json({ error: "Not found" });
        res.json({ message: "Marked as read", data: n });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /notification/:userId/read-all
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

// DELETE /notification/:id
const deleteNotification = async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /notification/:userId/clear-all
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
    createWonNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
};
