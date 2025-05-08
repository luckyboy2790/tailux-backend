const express = require("express");
const router = express.Router();
const pyamentController = require("../controllers/payment.controller");

router.get("/search_pending", pyamentController.getPendingPaymentSearch);

module.exports = router;
