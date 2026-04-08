const cron = require("node-cron");
const Payout = require("../models/PayoutModel");

const SETTLEMENT_MINUTES = (() => {
  const raw = Number(process.env.PAYOUT_SETTLEMENT_MINUTES || 2);
  if (!Number.isFinite(raw) || raw < 1) return 2;
  return Math.floor(raw);
})();

const settleProcessingWithdrawals = async () => {
  const cutoff = new Date(Date.now() - SETTLEMENT_MINUTES * 60 * 1000);

  try {
    const payoutWallets = await Payout.find({
      transactions: {
        $elemMatch: {
          status: "Processing",
          date: { $lte: cutoff },
        },
      },
    });

    if (!payoutWallets.length) return;

    let settledTxCount = 0;
    let affectedWallets = 0;

    for (const payout of payoutWallets) {
      let settledAmount = 0;
      let changed = false;

      for (const tx of payout.transactions) {
        if (tx.status !== "Processing") continue;
        const txDate = tx.date ? new Date(tx.date) : null;
        if (!txDate || txDate > cutoff) continue;

        tx.status = "Paid";
        settledAmount += Number(tx.amount || 0);
        settledTxCount += 1;
        changed = true;
      }

      if (!changed) continue;

      payout.pendingAmount = Math.max(
        0,
        Number(payout.pendingAmount || 0) - settledAmount
      );
      await payout.save();
      affectedWallets += 1;
    }

    if (settledTxCount > 0) {
      console.log(
        `[PayoutScheduler] Auto-settled ${settledTxCount} transaction(s) across ${affectedWallets} wallet(s).`
      );
    }
  } catch (err) {
    console.error("[PayoutScheduler] Auto-settlement failed:", err.message);
  }
};

const startPayoutSettlementScheduler = () => {
  cron.schedule("*/30 * * * * *", settleProcessingWithdrawals);
  console.log(
    `[PayoutScheduler] Started (window: ${SETTLEMENT_MINUTES} minute(s), checks every 30s).`
  );
};

module.exports = { startPayoutSettlementScheduler };

