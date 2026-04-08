const Wallet = require("../models/WalletModel");
const User   = require("../models/Usermodel");

// ── Helper: get-or-create wallet ─────────────────────────────────────────────
const getOrCreateWallet = async (userId) => {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) wallet = await Wallet.create({ userId });
    return wallet;
};

// ── Helper: resolve display name from User document ───────────────────────────
// Personal account → firstName + lastName
// Business account → businessName (or companyName as fallback)
const resolveUserName = (user) => {
    if (!user) return "";
    const isBusiness = user.role === "business" || user.accountType === "business";
    if (isBusiness) return user.businessName || user.companyName || "";
    return (
        ((user.firstName || user.first_name || "") + " " + (user.lastName || user.last_name || "")).trim()
        || user.name || user.username || ""
    );
};

// ── GET /wallet/:userId/wallet ────────────────────────────────────────────────
const getWallet = async (req, res) => {
    try {
        const wallet = await getOrCreateWallet(req.params.userId);

        // Always sync userName from User model so it stays current
        const user     = await User.findById(req.params.userId).lean();
        const userName = resolveUserName(user);
        if (userName && wallet.userName !== userName) {
            wallet.userName = userName;
            await wallet.save();
        }

        res.status(200).json({
            message:       "Wallet fetched successfully",
            userName:      wallet.userName,
            balance:       wallet.balance,
            lockedBalance: wallet.lockedBalance ?? 0,
            totalAdded:    wallet.totalAdded,
            totalSpent:    wallet.totalSpent,
        });
    } catch (err) {
        console.error("getWallet error:", err);
        res.status(500).json({ message: "Error fetching wallet", err: err.message });
    }
};

// ── POST /wallet/:userId/wallet/add ──────────────────────────────────────────
// Body: { amount, paymentId?, cardId? }
const addMoney = async (req, res) => {
    const { amount, cardId, paymentId } = req.body;
    if (!amount || isNaN(amount) || amount < 10) {
        return res.status(400).json({ message: "Amount must be at least ₹10." });
    }
    try {
        const wallet = await getOrCreateWallet(req.params.userId);

        const card  = cardId ? wallet.cards.id(cardId) : null;
        const label = card
            ? `Added via ${card.type === "visa" ? "Visa" : card.type === "master" ? "Mastercard" : card.type} •••• ${card.last4}`
            : paymentId
            ? `Added via Razorpay (${paymentId})`
            : "Added to wallet";

        wallet.balance    = +(wallet.balance    + amount).toFixed(2);
        wallet.totalAdded = +(wallet.totalAdded + amount).toFixed(2);
        wallet.transactions.unshift({ type: "credit", amount, label, category: "add_money", status: "completed" });

        // Sync userName if not yet set
        if (!wallet.userName) {
            const user = await User.findById(req.params.userId).lean();
            wallet.userName = resolveUserName(user);
        }

        await wallet.save();
        res.status(200).json({ message: "Money added successfully", newBalance: wallet.balance, transaction: wallet.transactions[0] });
    } catch (err) {
        console.error("addMoney error:", err);
        res.status(500).json({ message: "Error adding money", err: err.message });
    }
};

// ── POST /wallet/:userId/wallet/debit ────────────────────────────────────────
// Body: { amount, label, category, referenceId }
const debitWallet = async (req, res) => {
    const { amount, label, category, referenceId } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid debit amount." });
    }
    try {
        const wallet = await getOrCreateWallet(req.params.userId);
        if (wallet.balance < amount) {
            return res.status(400).json({ message: "Insufficient wallet balance." });
        }
        wallet.balance    = +(wallet.balance    - amount).toFixed(2);
        wallet.totalSpent = +(wallet.totalSpent + amount).toFixed(2);
        wallet.transactions.unshift({
            type: "debit", amount,
            label:       label       || "Wallet debit",
            category:    category    || "other",
            referenceId: referenceId || null,
            status: "completed",
        });
        await wallet.save();
        res.status(200).json({ message: "Wallet debited successfully", newBalance: wallet.balance, transaction: wallet.transactions[0] });
    } catch (err) {
        console.error("debitWallet error:", err);
        res.status(500).json({ message: "Error debiting wallet", err: err.message });
    }
};

// ── POST /wallet/:userId/wallet/lock ─────────────────────────────────────────
// Locks 5% of startingBid as security deposit to join an auction.
// Body: { auctionId, auctionTitle, startingBid }
const lockDeposit = async (req, res) => {
    const { auctionId, auctionTitle, startingBid } = req.body;
    if (!auctionId || !startingBid || isNaN(startingBid)) {
        return res.status(400).json({ message: "auctionId and startingBid are required." });
    }
    const lockAmount = +(startingBid * 0.05).toFixed(2);
    try {
        const wallet = await getOrCreateWallet(req.params.userId);

        // Idempotent — already locked for this auction
        const existing = wallet.locks.find(
            l => String(l.auctionId) === String(auctionId) && l.status === "active"
        );
        if (existing) {
            return res.status(200).json({
                message: "Deposit already locked", lockAmount,
                newBalance: wallet.balance, lockedBalance: wallet.lockedBalance,
            });
        }

        if (wallet.balance < lockAmount) {
            return res.status(400).json({
                message:   "Insufficient balance",
                required:  lockAmount,
                available: wallet.balance,
                shortfall: +(lockAmount - wallet.balance).toFixed(2),
            });
        }

        wallet.balance       = +(wallet.balance       - lockAmount).toFixed(2);
        wallet.lockedBalance = +((wallet.lockedBalance ?? 0) + lockAmount).toFixed(2);
        wallet.locks.push({ auctionId, amount: lockAmount, status: "active" });
        wallet.transactions.unshift({
            type: "debit", amount: lockAmount,
            label: `Security deposit locked for "${auctionTitle || "auction"}"`,
            category: "lock", status: "completed",
        });
        await wallet.save();

        res.status(200).json({
            message: "Deposit locked successfully", lockAmount,
            newBalance: wallet.balance, lockedBalance: wallet.lockedBalance,
        });
    } catch (err) {
        console.error("lockDeposit error:", err);
        res.status(500).json({ message: "Error locking deposit", err: err.message });
    }
};

// ── POST /wallet/:userId/wallet/unlock ───────────────────────────────────────
// Releases locked deposit back to spendable balance (non-winners / winner paid).
// Body: { auctionId, auctionTitle }
const unlockDeposit = async (req, res) => {
    const { auctionId, auctionTitle } = req.body;
    if (!auctionId) return res.status(400).json({ message: "auctionId is required." });
    try {
        const wallet = await getOrCreateWallet(req.params.userId);
        const lock   = wallet.locks.find(
            l => String(l.auctionId) === String(auctionId) && l.status === "active"
        );
        if (!lock) return res.status(404).json({ message: "No active lock found for this auction." });

        lock.status          = "released";
        wallet.balance       = +(wallet.balance       + lock.amount).toFixed(2);
        wallet.lockedBalance = +((wallet.lockedBalance ?? 0) - lock.amount).toFixed(2);
        wallet.transactions.unshift({
            type: "credit", amount: lock.amount,
            label: `Security deposit released for "${auctionTitle || "auction"}"`,
            category: "unlock", status: "completed",
        });
        await wallet.save();

        res.status(200).json({
            message: "Deposit released successfully", releasedAmount: lock.amount,
            newBalance: wallet.balance, lockedBalance: wallet.lockedBalance,
        });
    } catch (err) {
        console.error("unlockDeposit error:", err);
        res.status(500).json({ message: "Error releasing deposit", err: err.message });
    }
};

// ── POST /wallet/:userId/wallet/forfeit ──────────────────────────────────────
// Burns deposit as penalty when winner refuses to pay.
// Body: { auctionId, auctionTitle }
const forfeitDeposit = async (req, res) => {
    const { auctionId, auctionTitle } = req.body;
    if (!auctionId) return res.status(400).json({ message: "auctionId is required." });
    try {
        const wallet = await getOrCreateWallet(req.params.userId);
        const lock   = wallet.locks.find(
            l => String(l.auctionId) === String(auctionId) && l.status === "active"
        );
        if (!lock) return res.status(404).json({ message: "No active lock found for this auction." });

        lock.status          = "forfeited";
        wallet.lockedBalance = +((wallet.lockedBalance ?? 0) - lock.amount).toFixed(2);
        wallet.totalSpent    = +(wallet.totalSpent + lock.amount).toFixed(2);
        // balance NOT restored — forfeited as penalty
        wallet.transactions.unshift({
            type: "debit", amount: lock.amount,
            label: `Deposit forfeited — refused to complete purchase for "${auctionTitle || "auction"}"`,
            category: "penalty", status: "completed",
        });
        await wallet.save();

        res.status(200).json({
            message: "Deposit forfeited as penalty", forfeitedAmount: lock.amount,
            newBalance: wallet.balance, lockedBalance: wallet.lockedBalance,
        });
    } catch (err) {
        console.error("forfeitDeposit error:", err);
        res.status(500).json({ message: "Error forfeiting deposit", err: err.message });
    }
};

// ── POST /wallet/auction/:auctionId/release-all ──────────────────────────────
// Releases deposits for ALL non-winning bidders when an auction ends.
// Body: { winnerUserId, auctionTitle }
// Called by the auction scheduler / completion handler.
// ── SERVICE: release deposits — called directly by the scheduler (no req/res) ─
const releaseDepositsForAuction = async ({ auctionId, winnerUserId, auctionTitle }) => {
    const wallets  = await Wallet.find({ "locks": { $elemMatch: { auctionId, status: "active" } } });
    const released = [];

    for (const wallet of wallets) {
        // Skip the winner — their deposit is handled separately (unlock after payment)
        if (winnerUserId && String(wallet.userId) === String(winnerUserId)) continue;

        const lock = wallet.locks.find(
            l => String(l.auctionId) === String(auctionId) && l.status === "active"
        );
        if (!lock) continue;

        lock.status          = "released";
        wallet.balance       = +(wallet.balance       + lock.amount).toFixed(2);
        wallet.lockedBalance = +((wallet.lockedBalance ?? 0) - lock.amount).toFixed(2);
        wallet.transactions.unshift({
            type: "credit", amount: lock.amount,
            label: `Security deposit returned — auction ended for "${auctionTitle || "auction"}"`,
            category: "unlock", status: "completed",
        });
        await wallet.save();
        released.push(String(wallet.userId));
    }

    return released;
};

const releaseAllExceptWinner = async (req, res) => {
    const { auctionId } = req.params;
    const { winnerUserId, auctionTitle } = req.body;
    try {
        const wallets  = await Wallet.find({ "locks": { $elemMatch: { auctionId, status: "active" } } });
        const released = [];

        for (const wallet of wallets) {
            if (winnerUserId && String(wallet.userId) === String(winnerUserId)) continue;
            const lock = wallet.locks.find(
                l => String(l.auctionId) === String(auctionId) && l.status === "active"
            );
            if (!lock) continue;

            lock.status          = "released";
            wallet.balance       = +(wallet.balance       + lock.amount).toFixed(2);
            wallet.lockedBalance = +((wallet.lockedBalance ?? 0) - lock.amount).toFixed(2);
            wallet.transactions.unshift({
                type: "credit", amount: lock.amount,
                label: `Security deposit returned — auction ended for "${auctionTitle || "auction"}"`,
                category: "unlock", status: "completed",
            });
            await wallet.save();
            released.push(String(wallet.userId));
        }

        res.status(200).json({ message: "Deposits released for all non-winners", releasedFor: released });
    } catch (err) {
        console.error("releaseAllExceptWinner error:", err);
        res.status(500).json({ message: "Error releasing deposits", err: err.message });
    }
};

// ── GET /wallet/:userId/wallet/lock-status/:auctionId ────────────────────────
const getLockStatus = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ userId: req.params.userId });
        if (!wallet) return res.status(200).json({ locked: false, lockAmount: 0, balance: 0, lockedBalance: 0 });
        const lock = wallet.locks?.find(
            l => String(l.auctionId) === String(req.params.auctionId) && l.status === "active"
        );
        res.status(200).json({
            locked:        !!lock,
            lockAmount:    lock ? lock.amount : 0,
            balance:       wallet.balance,
            lockedBalance: wallet.lockedBalance ?? 0,
        });
    } catch (err) {
        console.error("getLockStatus error:", err);
        res.status(500).json({ message: "Error fetching lock status", err: err.message });
    }
};

// ── GET /wallet/:userId/transactions ─────────────────────────────────────────
const getTransactions = async (req, res) => {
    try {
        const wallet = await getOrCreateWallet(req.params.userId);
        const transactions = wallet.transactions.map((tx) => ({
            id:       tx._id,
            type:     tx.type,
            amount:   tx.amount,
            label:    tx.label,
            date:     tx.createdAt
                ? new Date(tx.createdAt).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })
                : "",
            status:   tx.status,
            category: tx.category,
        }));
        res.status(200).json({ message: "Transactions fetched", transactions });
    } catch (err) {
        console.error("getTransactions error:", err);
        res.status(500).json({ message: "Error fetching transactions", err: err.message });
    }
};

// ── GET /wallet/:userId/cards ─────────────────────────────────────────────────
const getCards = async (req, res) => {
    try {
        const wallet = await getOrCreateWallet(req.params.userId);
        res.status(200).json({ message: "Cards fetched", cards: wallet.cards });
    } catch (err) {
        console.error("getCards error:", err);
        res.status(500).json({ message: "Error fetching cards", err: err.message });
    }
};

// ── POST /wallet/:userId/cards ────────────────────────────────────────────────
const addCard = async (req, res) => {
    const { number, name, expiry, type } = req.body;
    if (!number || !name || !expiry) {
        return res.status(400).json({ message: "Card number, name, and expiry are required." });
    }
    const last4 = number.replace(/\s/g, "").slice(-4);
    if (!/^\d{4}$/.test(last4)) return res.status(400).json({ message: "Invalid card number." });
    try {
        const wallet      = await getOrCreateWallet(req.params.userId);
        const firstDigit  = number.replace(/\s/g, "")[0];
        const detectedType = type || (firstDigit === "4" ? "visa" : firstDigit === "5" ? "master" : firstDigit === "3" ? "amex" : firstDigit === "6" ? "rupay" : "other");
        wallet.cards.push({ type: detectedType, last4, expiry, name: name.trim(), isDefault: wallet.cards.length === 0 });
        await wallet.save();
        res.status(201).json({ message: "Card added successfully", card: wallet.cards[wallet.cards.length - 1] });
    } catch (err) {
        console.error("addCard error:", err);
        res.status(500).json({ message: "Error adding card", err: err.message });
    }
};

// ── DELETE /wallet/:userId/cards/:cardId ──────────────────────────────────────
const removeCard = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ userId: req.params.userId });
        if (!wallet) return res.status(404).json({ message: "Wallet not found." });
        const card = wallet.cards.id(req.params.cardId);
        if (!card)   return res.status(404).json({ message: "Card not found." });
        const wasDefault = card.isDefault;
        wallet.cards.pull(req.params.cardId);
        if (wasDefault && wallet.cards.length > 0) wallet.cards[0].isDefault = true;
        await wallet.save();
        res.status(200).json({ message: "Card removed successfully" });
    } catch (err) {
        console.error("removeCard error:", err);
        res.status(500).json({ message: "Error removing card", err: err.message });
    }
};

// ── PATCH /wallet/:userId/cards/:cardId/default ───────────────────────────────
const setDefaultCard = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ userId: req.params.userId });
        if (!wallet) return res.status(404).json({ message: "Wallet not found." });
        const card = wallet.cards.id(req.params.cardId);
        if (!card)   return res.status(404).json({ message: "Card not found." });
        wallet.cards.forEach((c) => { c.isDefault = false; });
        card.isDefault = true;
        await wallet.save();
        res.status(200).json({ message: "Default card updated", cards: wallet.cards });
    } catch (err) {
        console.error("setDefaultCard error:", err);
        res.status(500).json({ message: "Error updating default card", err: err.message });
    }
};


// ── POST /wallet/auction/:auctionId/release-all-bids ──────────────────────────
// Releases ALL locked deposits for an auction (called when auction is edited).
// No winner exclusion — everyone gets their deposit back since bids are reset.
const releaseAllDeposits = async (req, res) => {
    const { auctionId } = req.params;
    const { auctionTitle } = req.body;
    try {
        const mongoose   = require("mongoose");
        const auctionObjId = mongoose.Types.ObjectId.isValid(auctionId)
            ? new mongoose.Types.ObjectId(auctionId)
            : null;
        if (!auctionObjId) return res.status(400).json({ message: "Invalid auctionId." });

        const wallets = await Wallet.find({
            locks: { $elemMatch: { auctionId: auctionObjId, status: "active" } },
        });

        const saves    = [];
        const released = [];

        for (const wallet of wallets) {
            const lock = wallet.locks.find(
                l => String(l.auctionId) === String(auctionId) && l.status === "active"
            );
            if (!lock) continue;

            lock.status          = "released";
            wallet.balance       = +(wallet.balance + lock.amount).toFixed(2);
            wallet.lockedBalance = +Math.max(0, (wallet.lockedBalance ?? 0) - lock.amount).toFixed(2);
            wallet.transactions.unshift({
                type: "credit", amount: lock.amount,
                label:    `Security deposit refunded — auction "${auctionTitle || "auction"}" was edited and bids reset`,
                category: "unlock",
                status:   "completed",
            });
            saves.push(wallet.save());
            released.push(String(wallet.userId));
        }

        await Promise.all(saves);
        console.log(`[releaseAllDeposits] auctionId=${auctionId} released=${released.length}`);
        res.status(200).json({ message: "All deposits released", releasedFor: released, total: released.length });
    } catch (err) {
        console.error("releaseAllDeposits error:", err);
        res.status(500).json({ message: "Error releasing deposits", err: err.message });
    }
};

module.exports = {
    releaseDepositsForAuction,
    getWallet,
    addMoney,
    debitWallet,
    lockDeposit,
    unlockDeposit,
    forfeitDeposit,
    releaseAllExceptWinner,
    releaseAllDeposits,
    getLockStatus,
    getTransactions,
    getCards,
    addCard,
    removeCard,
    setDefaultCard,
};
