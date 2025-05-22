const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const verifyToken = require("../middlewares/authJWT");

router.get(
  "/search_pending",
  verifyToken,
  paymentController.getPendingPaymentSearch
);
router.post("/create", verifyToken, paymentController.createPayment);
router.post("/update", verifyToken, paymentController.updatePayment);
router.post("/delete/:id", verifyToken, paymentController.deletePayment);
router.get("/search", verifyToken, paymentController.searchPayments);
router.post("/approve/:id", verifyToken, paymentController.approvePayment);

module.exports = router;
