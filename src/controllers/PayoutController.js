const Payout = require("../models/PayoutModel");

// ── helpers ───────────────────────────────────────────────────────────────────
const generatePayoutId = () =>
  "PYT-" + Math.floor(1000 + Math.random() * 9000);

// =============================================================================
// GET /payout/seller/:sellerId
// Returns the full payout summary (balances + transactions) for Payouts.jsx
// =============================================================================
const getSellerPayout = async (req, res) => {
  try {
    // Find or auto-create a payout wallet for this seller
    let payout = await Payout.findOne({ sellerId: req.params.sellerId });

    if (!payout) {
      payout = await Payout.create({ sellerId: req.params.sellerId });
    }

    res.status(200).json({
      message: "Payout data fetched successfully",
      availableBalance: payout.availableBalance,
      pendingAmount:    payout.pendingAmount,
      totalEarned:      payout.totalEarned,
      totalAuctions:    payout.totalAuctions,
      transactions:     payout.transactions,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching payout data", err: err.message });
  }
};

// =============================================================================
// GET /payout/banks/:sellerId
// Returns linked bank / UPI accounts — Payouts.jsx fetches this separately
// =============================================================================
const getSellerBanks = async (req, res) => {
  try {
    let payout = await Payout.findOne({ sellerId: req.params.sellerId });

    if (!payout) {
      payout = await Payout.create({ sellerId: req.params.sellerId });
    }

    res.status(200).json({
      message: "Banks fetched successfully",
      banks: payout.banks,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching banks", err: err.message });
  }
};

// =============================================================================
// POST /payout/banks/:sellerId
// Add a new bank / UPI account
// Body: { logoText, name, accountNum, ifsc?, accountType?, isDefault? }
// =============================================================================
const addBank = async (req, res) => {
  try {
    const { logoText, name, accountNum, ifsc, accountType, isDefault } = req.body;

    if (!name || !accountNum) {
      return res.status(400).json({ message: "name and accountNum are required" });
    }

    let payout = await Payout.findOne({ sellerId: req.params.sellerId });
    if (!payout) {
      payout = await Payout.create({ sellerId: req.params.sellerId });
    }

    // If this one is default, unset all others first
    if (isDefault) {
      payout.banks.forEach((b) => (b.isDefault = false));
    }

    // If it is the first account, make it default automatically
    const makeDefault = isDefault || payout.banks.length === 0;

    payout.banks.push({ logoText, name, accountNum, ifsc, accountType, isDefault: makeDefault });
    await payout.save();

    res.status(201).json({ message: "Bank account added successfully", banks: payout.banks });
  } catch (err) {
    res.status(500).json({ message: "Error adding bank account", err: err.message });
  }
};

// =============================================================================
// DELETE /payout/banks/:sellerId/:bankId
// Remove a linked bank / UPI account
// =============================================================================
const removeBank = async (req, res) => {
  try {
    const payout = await Payout.findOne({ sellerId: req.params.sellerId });
    if (!payout) return res.status(404).json({ message: "Payout wallet not found" });

    const bankIndex = payout.banks.findIndex(
      (b) => b._id.toString() === req.params.bankId
    );
    if (bankIndex === -1) return res.status(404).json({ message: "Bank not found" });

    const wasDefault = payout.banks[bankIndex].isDefault;
    payout.banks.splice(bankIndex, 1);

    // Auto-assign default to first remaining account if the removed one was default
    if (wasDefault && payout.banks.length > 0) {
      payout.banks[0].isDefault = true;
    }

    await payout.save();
    res.status(200).json({ message: "Bank removed successfully", banks: payout.banks });
  } catch (err) {
    res.status(500).json({ message: "Error removing bank", err: err.message });
  }
};

// =============================================================================
// PATCH /payout/banks/:sellerId/:bankId/default
// Set a bank account as default
// =============================================================================
const setDefaultBank = async (req, res) => {
  try {
    const payout = await Payout.findOne({ sellerId: req.params.sellerId });
    if (!payout) return res.status(404).json({ message: "Payout wallet not found" });

    payout.banks.forEach((b) => {
      b.isDefault = b._id.toString() === req.params.bankId;
    });

    await payout.save();
    res.status(200).json({ message: "Default bank updated", banks: payout.banks });
  } catch (err) {
    res.status(500).json({ message: "Error updating default bank", err: err.message });
  }
};

// =============================================================================
// POST /payout/withdraw/:sellerId
// Initiate a withdrawal
// Body: { amount, bankId }
// =============================================================================
const withdraw = async (req, res) => {
  try {
    const { amount, bankId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid withdrawal amount" });
    }

    const payout = await Payout.findOne({ sellerId: req.params.sellerId });
    if (!payout) return res.status(404).json({ message: "Payout wallet not found" });

    if (amount > payout.availableBalance) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Find the target bank
    const bank = bankId
      ? payout.banks.find((b) => b._id.toString() === bankId)
      : payout.banks.find((b) => b.isDefault);

    if (!bank) {
      return res.status(400).json({ message: "No bank account selected or linked" });
    }

    // Deduct from available, add to pending
    payout.availableBalance -= amount;
    payout.pendingAmount    += amount;

    // Create a transaction record
    const newTx = {
      payoutId:     generatePayoutId(),
      auctionTitle: "Manual Withdrawal",
      amount,
      method:       bank.name,
      status:       "Processing",
      date:         new Date(),
    };
    payout.transactions.unshift(newTx);   // newest first

    await payout.save();

    res.status(200).json({
      message: "Withdrawal initiated successfully",
      transaction: newTx,
      availableBalance: payout.availableBalance,
      pendingAmount:    payout.pendingAmount,
    });
  } catch (err) {
    res.status(500).json({ message: "Error processing withdrawal", err: err.message });
  }
};

// =============================================================================
// POST /payout/credit/:sellerId
// (Internal / admin) Credit earnings after an auction closes
// Body: { auctionId, auctionTitle, amount }
// =============================================================================
const creditEarning = async (req, res) => {
  try {
    const { auctionId, auctionTitle, amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    let payout = await Payout.findOne({ sellerId: req.params.sellerId });
    if (!payout) {
      payout = await Payout.create({ sellerId: req.params.sellerId });
    }

    const platformFee = Math.round(amount * 0.05);   // 5% fee
    const netAmount   = amount - platformFee;

    payout.availableBalance += netAmount;
    payout.totalEarned      += amount;
    payout.totalAuctions    += 1;

    payout.transactions.unshift({
      payoutId:     generatePayoutId(),
      auctionId:    auctionId || null,
      auctionTitle: auctionTitle || "Auction",
      amount:       netAmount,
      method:       "Bank Transfer",
      status:       "Paid",
      date:         new Date(),
    });

    await payout.save();

    res.status(200).json({
      message: "Earning credited successfully",
      availableBalance: payout.availableBalance,
      totalEarned:      payout.totalEarned,
    });
  } catch (err) {
    res.status(500).json({ message: "Error crediting earning", err: err.message });
  }
};

// =============================================================================
// PATCH /payout/transaction/:sellerId/:txId
// (Admin) Update a transaction status — e.g. Processing → Paid / Failed
// Body: { status }
// =============================================================================
const updateTransactionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Pending", "Processing", "Paid", "Failed"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const payout = await Payout.findOne({ sellerId: req.params.sellerId });
    if (!payout) return res.status(404).json({ message: "Payout wallet not found" });

    const tx = payout.transactions.id(req.params.txId);
    if (!tx) return res.status(404).json({ message: "Transaction not found" });

    const prevStatus = tx.status;
    tx.status = status;

    // Adjust pending amount when a withdrawal settles or fails
    if (prevStatus === "Processing" || prevStatus === "Pending") {
      if (status === "Paid") {
        payout.pendingAmount = Math.max(0, payout.pendingAmount - tx.amount);
      } else if (status === "Failed") {
        // Refund back to available balance
        payout.availableBalance += tx.amount;
        payout.pendingAmount     = Math.max(0, payout.pendingAmount - tx.amount);
      }
    }

    await payout.save();
    res.status(200).json({ message: "Transaction status updated", transaction: tx });
  } catch (err) {
    res.status(500).json({ message: "Error updating transaction", err: err.message });
  }
};

module.exports = {
  getSellerPayout,
  getSellerBanks,
  addBank,
  removeBank,
  setDefaultBank,
  withdraw,
  creditEarning,
  updateTransactionStatus,
};
