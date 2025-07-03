const Payment = require("../models/payment.model");

exports.getPendingPaymentSearch = async (req, res) => {
  try {
    const payments = await Payment.searchPending(req);
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

exports.updatePayment = async (req, res) => {
  try {
    const paymentId = await Payment.update(req);

    res.json(paymentId);
  } catch (error) {
    console.error(error);
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const paymentId = await Payment.delete(req);

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

exports.approvePayment = async (req, res) => {
  try {
    const payment = await Payment.approve(req);

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.concurrentPaymentCreate = async (req, res) => {
  try {
    const paymentId = await Payment.concurrentPaymentCreate(req);

    res.status(200).json(paymentId);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};
