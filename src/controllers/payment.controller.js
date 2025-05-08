const Payment = require("../models/payment.model");

exports.getPendingPaymentSearch = async (req, res) => {
  try {
    const payments = await Payment.searchPending(req, res);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
