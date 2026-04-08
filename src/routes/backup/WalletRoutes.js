const router           = require("express").Router();
const walletController = require("../controllers/WalletController");

// ── Wallet balance ────────────────────────────────────────────────────────────
router.get  ("/:userId/wallet",                         walletController.getWallet);
router.post ("/:userId/wallet/add",                     walletController.addMoney);
router.post ("/:userId/wallet/debit",                   walletController.debitWallet);

// ── Security deposit lock / unlock / forfeit ──────────────────────────────────
router.post ("/:userId/wallet/lock",                    walletController.lockDeposit);
router.post ("/:userId/wallet/unlock",                  walletController.unlockDeposit);
router.post ("/:userId/wallet/forfeit",                 walletController.forfeitDeposit);
router.get  ("/:userId/wallet/lock-status/:auctionId",  walletController.getLockStatus);

// ── Release deposits when auction ends (auction scheduler) ──────────────────────
router.post ("/auction/:auctionId/release-all",         walletController.releaseAllExceptWinner);
// ── Release ALL deposits + reset bids when auction is edited ────────────────────
router.post ("/auction/:auctionId/release-all-bids",    walletController.releaseAllDeposits);

// ── Transactions ──────────────────────────────────────────────────────────────
router.get  ("/:userId/transactions",                   walletController.getTransactions);

// ── Cards ─────────────────────────────────────────────────────────────────────
router.get   ("/:userId/cards",                         walletController.getCards);
router.post  ("/:userId/cards",                         walletController.addCard);
router.delete("/:userId/cards/:cardId",                 walletController.removeCard);
router.patch ("/:userId/cards/:cardId/default",         walletController.setDefaultCard);

module.exports = router;
