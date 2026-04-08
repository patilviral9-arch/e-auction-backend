const Payout = require("../models/PayoutModel");
const Razorpay = require("razorpay");
const User = require("../models/Usermodel");

// ── helpers ───────────────────────────────────────────────────────────────────
const generatePayoutId = () =>
  "PYT-" + Math.floor(1000 + Math.random() * 9000);

const RAZORPAY_PAYOUT_SOURCE_ACCOUNT =
  process.env.RAZORPAYX_ACCOUNT_NUMBER || process.env.RAZORPAY_ACCOUNT_NUMBER || "";

const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return "";
};

const resolveContactName = (seller, bank) => {
  const fullName = `${seller?.firstName || ""} ${seller?.lastName || ""}`.trim();
  const candidate =
    seller?.businessName ||
    seller?.ownerName ||
    fullName ||
    bank?.name ||
    "Auction Seller";
  return String(candidate).trim().slice(0, 50) || "Auction Seller";
};

const mapRazorpayPayoutStatus = (statusValue) => {
  const status = String(statusValue || "").toLowerCase();
  if (status === "processed") return "Paid";
  if (["failed", "rejected", "cancelled", "reversed"].includes(status)) return "Failed";
  return "Processing";
};

const createRazorpayPayout = async ({ sellerId, bank, amount }) => {
  if (!process.env.RAZORPAY_KEY || !process.env.RAZORPAY_SECRET) {
    return { ok: false, message: "Razorpay credentials are missing on server." };
  }

  if (!RAZORPAY_PAYOUT_SOURCE_ACCOUNT) {
    return {
      ok: false,
      message: "Razorpay payout account is not configured. Set RAZORPAYX_ACCOUNT_NUMBER in backend .env.",
    };
  }

  const rawAccount = String(bank?.accountNum || "").trim();
  const isUpi = rawAccount.includes("@");
  const normalizedAccount = rawAccount.replace(/\s+/g, "");
  const normalizedIfsc = String(bank?.ifsc || "").trim().toUpperCase();

  if (!rawAccount) {
    return { ok: false, message: "Selected payout account is missing account details." };
  }

  if (!isUpi && !normalizedIfsc) {
    return { ok: false, message: "IFSC code is required for bank withdrawals via Razorpay." };
  }

  try {
    const seller = await User.findById(sellerId).lean().catch(() => null);
    const phone = normalizePhone(
      seller?.phone || seller?.PhoneNumber || seller?.alternatePhone
    );

    if (!phone) {
      return {
        ok: false,
        message: "Add a valid 10-digit phone number in your profile before withdrawing via Razorpay.",
      };
    }

    const contactName = resolveContactName(seller, bank);
    const email = String(seller?.email || `seller-${String(sellerId)}@example.com`).trim().toLowerCase();
    const referenceBase = `seller_${String(sellerId)}`;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    const contact = await razorpay.contacts.create({
      name: contactName,
      type: "vendor",
      email,
      contact: phone,
      reference_id: referenceBase.slice(0, 40),
      notes: {
        sellerId: String(sellerId).slice(0, 64),
      },
    });

    const fundAccountPayload = isUpi
      ? {
          contact_id: contact.id,
          account_type: "vpa",
          vpa: {
            address: rawAccount.toLowerCase(),
          },
        }
      : {
          contact_id: contact.id,
          account_type: "bank_account",
          bank_account: {
            name: contactName,
            ifsc: normalizedIfsc,
            account_number: normalizedAccount,
          },
        };

    const fundAccount = await razorpay.fundAccount.create(fundAccountPayload);
    const payout = await razorpay.payouts.create({
      account_number: RAZORPAY_PAYOUT_SOURCE_ACCOUNT,
      fund_account_id: fundAccount.id,
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      mode: isUpi ? "UPI" : "IMPS",
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: `${referenceBase}_${Date.now()}`.slice(0, 40),
      narration: "Auction withdrawal",
      notes: {
        bankName: String(bank?.name || "").slice(0, 40),
      },
    });

    const mappedStatus = mapRazorpayPayoutStatus(payout?.status);
    if (mappedStatus === "Failed") {
      return {
        ok: false,
        message:
          payout?.status_details?.description ||
          "Razorpay could not process this withdrawal right now.",
      };
    }

    return {
      ok: true,
      status: mappedStatus,
      payoutId: payout?.id || "",
      rawStatus: String(payout?.status || ""),
      methodLabel: isUpi ? "Razorpay UPI" : "Razorpay Bank Transfer",
      settlementMessage:
        mappedStatus === "Paid"
          ? "Withdrawal completed via Razorpay."
          : "Withdrawal initiated via Razorpay and is being processed.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err?.error?.description ||
        err?.error?.reason ||
        err?.message ||
        "Razorpay payout request failed.",
    };
  }
};

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

    // Hide duplicate paid-credit rows for the same auction (legacy duplicates).
    const seenAuctionCredits = new Set();
    const dedupedTransactions = (payout.transactions || []).filter((tx) => {
      const auctionId = tx?.auctionId ? String(tx.auctionId) : "";
      const isPaidCredit = auctionId && tx?.status === "Paid";
      if (!isPaidCredit) return true;
      if (seenAuctionCredits.has(auctionId)) return false;
      seenAuctionCredits.add(auctionId);
      return true;
    });

    res.status(200).json({
      message: "Payout data fetched successfully",
      availableBalance: payout.availableBalance,
      pendingAmount:    payout.pendingAmount,
      totalEarned:      payout.totalEarned,
      totalAuctions:    payout.totalAuctions,
      transactions:     dedupedTransactions,
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
// Body: { amount, bankId, gateway? }
// =============================================================================
const withdraw = async (req, res) => {
  try {
    const { amount, bankId, gateway } = req.body;
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: "Invalid withdrawal amount" });
    }

    const payout = await Payout.findOne({ sellerId: req.params.sellerId });
    if (!payout) return res.status(404).json({ message: "Payout wallet not found" });

    if (numericAmount > Number(payout.availableBalance || 0)) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Find the target bank
    const bank = bankId
      ? payout.banks.find((b) => b._id.toString() === bankId)
      : payout.banks.find((b) => b.isDefault);

    if (!bank) {
      return res.status(400).json({ message: "No bank account selected or linked" });
    }

    const requestedGateway = String(gateway || "manual").toLowerCase();
    const useRazorpay = requestedGateway === "razorpay";
    let txStatus = "Processing";
    let txMethod = bank.name;
    let txNote = "";
    let responseMessage = "Withdrawal initiated successfully";
    let gatewayPayoutId = null;

    if (useRazorpay) {
      const razorpayResult = await createRazorpayPayout({
        sellerId: req.params.sellerId,
        bank,
        amount: numericAmount,
      });

      if (!razorpayResult?.ok) {
        return res.status(400).json({
          message: razorpayResult?.message || "Unable to initiate Razorpay withdrawal.",
        });
      }

      txStatus = razorpayResult.status || "Processing";
      txMethod = razorpayResult.methodLabel || "Razorpay";
      txNote = `Gateway Razorpay | payout_id ${razorpayResult.payoutId || "NA"} | status ${razorpayResult.rawStatus || "NA"}`;
      responseMessage = razorpayResult.settlementMessage || responseMessage;
      gatewayPayoutId = razorpayResult.payoutId || null;
    }

    payout.availableBalance -= numericAmount;
    if (txStatus !== "Paid") {
      payout.pendingAmount += numericAmount;
    }

    // Create a transaction record
    const newTx = {
      payoutId:     generatePayoutId(),
      auctionTitle: useRazorpay ? "Razorpay Withdrawal" : "Manual Withdrawal",
      amount:       numericAmount,
      method:       txMethod,
      status:       txStatus,
      date:         new Date(),
      note:         txNote || undefined,
    };
    payout.transactions.unshift(newTx);   // newest first

    await payout.save();

    res.status(200).json({
      message: responseMessage,
      gateway: useRazorpay ? "razorpay" : "manual",
      gatewayPayoutId,
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
    const numericAmount = Number(amount || 0);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    let payout = await Payout.findOne({ sellerId: req.params.sellerId });
    if (!payout) {
      payout = await Payout.create({ sellerId: req.params.sellerId });
    }

    const platformFee = Math.round(numericAmount * 0.05);   // 5% fee
    const netAmount   = numericAmount - platformFee;

    // Idempotency: avoid double-credit for the same auction.
    if (auctionId) {
      const alreadyCredited = payout.transactions.find(
        (tx) =>
          tx?.auctionId &&
          String(tx.auctionId) === String(auctionId) &&
          tx?.status === "Paid"
      );
      if (alreadyCredited) {
        return res.status(200).json({
          message: "Earning already credited for this auction",
          availableBalance: payout.availableBalance,
          totalEarned: payout.totalEarned,
          transaction: alreadyCredited,
        });
      }
    }

    payout.availableBalance += netAmount;
    payout.totalEarned      += numericAmount;
    payout.totalAuctions    += 1;

    payout.transactions.unshift({
      payoutId:     generatePayoutId(),
      auctionId:    auctionId || null,
      auctionTitle: auctionTitle || "Auction",
      amount:       netAmount,
      method:       "Bank Transfer",
      status:       "Paid",
      date:         new Date(),
      note:         `Gross ₹${numericAmount} − 5% platform fee (₹${platformFee}) = ₹${netAmount} credited`,
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

