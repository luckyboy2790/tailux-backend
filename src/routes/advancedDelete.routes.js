const express = require("express");
const router = express.Router();
const advancedDeleteController = require("../controllers/advancedDelete.controller");

router.post("/verify/send-code", advancedDeleteController.sendVerificationCode);
router.post("/purchase/submit", advancedDeleteController.submitAdvancedDelete);

module.exports = router;
