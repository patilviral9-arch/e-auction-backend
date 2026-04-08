const router = require("express").Router();
const notificationController = require("../controllers/NotificationController");

// ── GET ───────────────────────────────────────────────────────────────────────
// ⚠️ Specific paths MUST come before /:userId — otherwise Express matches /:userId first

// Unread count only — used by navbar bell badge
router.get("/:userId/unread-count", notificationController.getUnreadCount);

// All notifications for a user (newest first, limit 100)
router.get("/:userId", notificationController.getNotifications);

// ── PATCH ─────────────────────────────────────────────────────────────────────
// ⚠️ read-all must come before /:id/read
router.patch("/:userId/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);

// ── DELETE ────────────────────────────────────────────────────────────────────
// ⚠️ clear-all must come before /:id
router.delete("/:userId/clear-all", notificationController.clearAllNotifications);
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;
