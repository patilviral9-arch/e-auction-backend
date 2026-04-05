const router           = require("express").Router();
const payoutController = require("../controllers/PayoutController");

// ── Payout summary & banks (read) ─────────────────────────────────────────────
router.get("/seller/:sellerId",          payoutController.getSellerPayout);        // GET /payout/seller/:sellerId
router.get("/banks/:sellerId",           payoutController.getSellerBanks);         // GET /payout/banks/:sellerId

// ── Bank account management ───────────────────────────────────────────────────
router.post("/banks/:sellerId",          payoutController.addBank);                // POST /payout/banks/:sellerId
router.delete("/banks/:sellerId/:bankId",payoutController.removeBank);             // DELETE /payout/banks/:sellerId/:bankId
router.patch("/banks/:sellerId/:bankId/default", payoutController.setDefaultBank); // PATCH /payout/banks/:sellerId/:bankId/default

// ── Transactions ──────────────────────────────────────────────────────────────
router.post("/withdraw/:sellerId",                      payoutController.withdraw);                // POST /payout/withdraw/:sellerId
router.post("/credit/:sellerId",                        payoutController.creditEarning);           // POST /payout/credit/:sellerId  (internal/admin)
router.patch("/transaction/:sellerId/:txId",            payoutController.updateTransactionStatus); // PATCH /payout/transaction/:sellerId/:txId

module.exports = router;
