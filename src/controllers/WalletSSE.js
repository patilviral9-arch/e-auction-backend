/**
 * WalletSSE.js
 * Server-Sent Events manager for real-time wallet updates.
 *
 * Usage in your Express app:
 *   const { sseMiddleware } = require("./WalletSSE");
 *   app.use("/wallet-events", sseMiddleware);   // or mount under your wallet router prefix
 *
 * In WalletController.js it is already imported and notifyUser() is called
 * after every balance-changing operation automatically.
 */

// Map of userId (string) → Set of SSE response objects
const clients = new Map();

/**
 * Register a new SSE client.
 * Called by the GET /wallet-events/:userId route.
 */
const sseMiddleware = (req, res) => {
    const userId = req.params.userId;
    if (!userId) return res.status(400).end();

    // SSE headers
    res.setHeader("Content-Type",  "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection",    "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if present
    res.flushHeaders();

    // Add to client map
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(res);

    // Send an initial "connected" event so the client knows the stream is live
    res.write(`event: connected\ndata: {"userId":"${userId}"}\n\n`);

    // Heartbeat every 25 s to keep the connection alive through proxies / load balancers
    const heartbeat = setInterval(() => {
        try { res.write(": heartbeat\n\n"); } catch { /* ignore */ }
    }, 25_000);

    // Clean up when client disconnects
    req.on("close", () => {
        clearInterval(heartbeat);
        const set = clients.get(userId);
        if (set) {
            set.delete(res);
            if (set.size === 0) clients.delete(userId);
        }
    });
};

/**
 * Push a wallet_update event to all active connections for a userId.
 * Call this after any balance-changing DB write.
 *
 * @param {string} userId
 * @param {object} [payload]  Optional extra data (e.g. { newBalance, lockedBalance })
 */
const notifyUser = (userId, payload = {}) => {
    const set = clients.get(String(userId));
    if (!set || set.size === 0) return; // user not connected — no-op

    const data = JSON.stringify({ ...payload, ts: Date.now() });
    const msg  = `event: wallet_update\ndata: ${data}\n\n`;

    for (const res of set) {
        try { res.write(msg); } catch { /* stale connection — leave cleanup to close handler */ }
    }
};

module.exports = { sseMiddleware, notifyUser };
