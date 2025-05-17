const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");

router.get("/search_pending", paymentController.getPendingPaymentSearch);
router.post("/create", paymentController.createPayment);
router.post("/update", paymentController.updatePayment);
router.post("/delete/:id", paymentController.deletePayment);
router.get("/search", paymentController.searchPayments);
router.post("/approve/:id", paymentController.approvePayment);

module.exports = router;
