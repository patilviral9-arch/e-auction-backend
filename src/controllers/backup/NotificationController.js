const Notification = require("../models/NotificationModel");
const Auction      = require("../models/AuctionModel");
const Wishlist     = require("../models/WishlistModel");   // adjust path if needed
const AuctionResult = require("../models/AuctionResultModel"); // adjust path if needed

// ── Milestone config (must match frontend) ────────────────────────────────────
const WINDOW_MS        = 20 * 60 * 1000; // ±20 min window per milestone
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
        won:         `🏆 Congratulations! You won "${t}". Complete your payment to claim it.`,
    };
    return map[type] || `Notification about "${t}"`;
};

// ── Helper: safely create notification (skip if duplicate) ────────────────────
const createIfNew = async (userId, auctionId, type, message, auctionResultId = null) => {
    const dedupeKey = `${type}-${userId}-${auctionId}`;
    try {
        await Notification.create({ userId, auctionId, type, message, dedupeKey, auctionResultId });
        return true; // created
    } catch (err) {
        if (err.code === 11000) return false; // duplicate — already sent
        throw err;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEDULER — called by AuctionScheduler every 30s
//  Generates milestone notifications for all wishlisted auctions
// ═══════════════════════════════════════════════════════════════════════════════
const generateMilestoneNotifications = async () => {
    const now = Date.now();
    let created = 0;

    try {
        // Get all wishlist entries with populated auction
        const wishlists = await Wishlist.find({}).populate("auction");

        for (const entry of wishlists) {
            const auction = entry.auction;
            const userId  = entry.userId ?? entry.user;

            if (!auction || !userId) continue;

            const start = new Date(auction.startDate).getTime();
            const end   = new Date(auction.endTime).getTime();

            // ── ENDING milestones (auction must be Active) ──────────────────────
            if (auction.status === "Active" && end > now) {
                for (const hrs of END_MILESTONES) {
                    const milestoneMs = hrs * 60 * 60 * 1000;
                    const timeLeft    = end - now;
                    if (timeLeft >= milestoneMs - WINDOW_MS && timeLeft <= milestoneMs + WINDOW_MS) {
                        const type    = `ending_${hrs}h`;
                        const message = buildMessage(type, auction.title);
                        const ok = await createIfNew(userId, auction._id, type, message);
                        if (ok) created++;
                    }
                }
            }

            // ── STARTING milestones (auction must be Scheduled) ─────────────────
            if (auction.status === "Scheduled" && start > now) {
                for (const hrs of START_MILESTONES) {
                    const milestoneMs = hrs * 60 * 60 * 1000;
                    const timeToStart = start - now;
                    if (timeToStart >= milestoneMs - WINDOW_MS && timeToStart <= milestoneMs + WINDOW_MS) {
                        const type    = `starting_${hrs}h`;
                        const message = buildMessage(type, auction.title);
                        const ok = await createIfNew(userId, auction._id, type, message);
                        if (ok) created++;
                    }
                }
            }

            // ── JUST STARTED (within last 30 min) ──────────────────────────────
            if (auction.status === "Active" && now - start >= 0 && now - start < 30 * 60 * 1000) {
                const type    = "starting";
                const message = buildMessage(type, auction.title);
                const ok = await createIfNew(userId, auction._id, type, message);
                if (ok) created++;
            }
        }

        if (created > 0) {
            console.log(`[NotificationController] 🔔 ${created} new milestone notification(s) created`);
        }
    } catch (err) {
        console.error("[NotificationController] ❌ generateMilestoneNotifications error:", err.message);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEDULER — called when an auction result is saved (user wins)
// ═══════════════════════════════════════════════════════════════════════════════
const createWonNotification = async (userId, auctionId, auctionResultId) => {
    try {
        const auction = await Auction.findById(auctionId);
        const message = buildMessage("won", auction?.title);
        await createIfNew(userId, auctionId, "won", message, auctionResultId);
        console.log(`[NotificationController] 🏆 Won notification created for user ${userId}`);
    } catch (err) {
        console.error("[NotificationController] ❌ createWonNotification error:", err.message);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  REST ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /notification/:userId
// Returns all notifications for a user, newest first
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.params.userId })
            .populate("auctionId")
            .populate("auctionResultId")
            .sort({ createdAt: -1 })
            .limit(100);

        // Shape the response to match what the frontend expects
        const shaped = notifications.map((n) => ({
            _id:             n._id,
            type:            n.type,
            isRead:          n.isRead,
            message:         n.message,
            createdAt:       n.createdAt,
            auction:         n.auctionId,        // populated auction object
            result:          n.auctionResultId,  // populated result or null
            dedupeKey:       n.dedupeKey,
        }));

        res.json({ notifications: shaped });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /notification/:userId/unread-count
// Returns just the unread count (for navbar bell badge)
const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            userId: req.params.userId,
            isRead: false,
        });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /notification/:id/read
// Mark a single notification as read
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ error: "Notification not found" });
        res.json({ message: "Marked as read", data: notification });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /notification/:userId/read-all
// Mark ALL notifications for a user as read
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
// Delete a single notification
const deleteNotification = async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: "Notification deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /notification/:userId/clear-all
// Delete all notifications for a user
const clearAllNotifications = async (req, res) => {
    try {
        const result = await Notification.deleteMany({ userId: req.params.userId });
        res.json({ message: "All notifications cleared", deleted: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    // Scheduler hooks (called internally, not via REST)
    generateMilestoneNotifications,
    createWonNotification,

    // REST handlers
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
};
