const router = require("express").Router();
const notificationController = require("../controllers/NotificationController");

// ── GET ───────────────────────────────────────────────────────────────────────
// All notifications for a user (newest first, limit 100)
router.get("/:userId", notificationController.getNotifications);

// Unread count only — used by navbar bell badge
router.get("/:userId/unread-count", notificationController.getUnreadCount);

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Mark a single notification as read
router.patch("/:id/read", notificationController.markAsRead);

// Mark ALL notifications as read for a user
router.patch("/:userId/read-all", notificationController.markAllAsRead);

// ── DELETE ────────────────────────────────────────────────────────────────────
// Delete a single notification
router.delete("/:id", notificationController.deleteNotification);

// Delete ALL notifications for a user
router.delete("/:userId/clear-all", notificationController.clearAllNotifications);

module.exports = router;
