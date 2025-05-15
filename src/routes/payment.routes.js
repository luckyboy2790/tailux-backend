const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");

router.get("/search_pending", paymentController.getPendingPaymentSearch);
router.post("/create", paymentController.createPayment);
router.get("/search", paymentController.searchPayments);

module.exports = router;
