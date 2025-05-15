const Payment = require("../models/payment.model");

exports.getPendingPaymentSearch = async (req, res) => {
  try {
    const payments = await Payment.searchPending(req, res);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const paymentId = await Payment.create(req);

    res.json(paymentId);
  } catch (error) {
    console.error(error);
  }
};

exports.searchPayments = async (req, res) => {
  try {
    const payments = await Payment.search(req);

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};
