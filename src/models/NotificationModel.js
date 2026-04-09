const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        // ── Who receives this notification ─────────────────────────────────────
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // ── What type of notification ──────────────────────────────────────────
        type: {
            type: String,
            enum: [
                "ending_3h",    // wishlisted auction ending in ~3 hours
                "ending_2h",    // wishlisted auction ending in ~2 hours
                "ending_1h",    // wishlisted auction ending in ~1 hour
                "starting_3h",  // wishlisted auction starting in ~3 hours
                "starting_2h",  // wishlisted auction starting in ~2 hours
                "starting_1h",  // wishlisted auction starting in ~1 hour
                "starting",     // wishlisted auction just started
                "starting_24h", // wishlisted scheduled auction starts in ~24 hours
                "outbid",       // bidder was outbid by another user
                "lost",         // bidder lost the auction
                "payment_success", // winner payment succeeded
                "payment_failed",  // winner payment failed
                "auction_created", // seller created auction successfully
                "reserve_reached", // seller reserve price reached
                "auction_sold",    // seller auction sold successfully
                "no_bids_or_reserve_not_met", // seller auction not sold
                "buyer_completed_payment",    // seller notified of buyer payment
                "won",          // user won an auction — pay now
            ],
            required: true,
        },

        // ── The auction this notification is about ─────────────────────────────
        auctionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Auction",
            required: true,
        },

        // ── Human-readable message ─────────────────────────────────────────────
        message: {
            type: String,
            required: true,
        },

        // ── Read / unread state ────────────────────────────────────────────────
        isRead: {
            type: Boolean,
            default: false,
        },

        // ── For "won" notifications: link to the auction result ────────────────
        auctionResultId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AuctionResult",
            default: null,
        },

        // ── Deduplication key: prevents the same milestone firing twice ─────────
        // Format: "<type>-<userId>-<auctionId>"
        dedupeKey: {
            type: String,
            unique: true,
            required: true,
        },
    },
    {
        timestamps: true, // createdAt = when notification was generated
    }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });


// ── Auto-delete notifications older than 7 days ───────────────────────────────
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports =
    mongoose.models.Notification ||
    mongoose.model("Notification", notificationSchema);
