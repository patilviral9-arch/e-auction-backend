const router         = require("express").Router();
const userController = require("../controllers/UserController");

// ── OTP (must be BEFORE /register so the flow is: send → verify → register) ──
router.post("/send-otp",   userController.sendOtp);
router.post("/resend-otp", userController.resendOtp);
router.post("/verify-otp", userController.verifyOtp);

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post("/register",          userController.registerUser);
router.post("/login",             userController.loginUser);
router.post("/forgetpassword",    userController.forgotPassword);
router.put("/resetpassword",      userController.resetPassword);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get("/getusers",           userController.getallusers);
router.get("/getuser/:id",        userController.getUser);
router.put("/updateuser/:id",     userController.updateUser);
router.delete("/deleteuser/:id",  userController.deleteUser);

module.exports = router;
