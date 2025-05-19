const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const verifyToken = require("../middlewares/authJWT");

router.post("/login", authController.login);
router.post("/2fa", authController.checkOTP);
router.post("/qr/generate/:user_id", authController.generate2FACode);
router.get("/user/profile", verifyToken, authController.getUserProfile);

module.exports = router;
