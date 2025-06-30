const Purchase = require("../models/purchase.model");

exports.getPurchaseSearch = async (req, res) => {
  try {
    const purchases = await Purchase.searchPurchases(req.query, req.user);
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getPendingPurchaseSearch = async (req, res) => {
  try {
    const purchases = await Purchase.searchPendingPurchases(req);
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getPurchaseDetail = async (req, res) => {
  try {
    const purchases = await Purchase.getPurchaseDetail(req);
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.createPurchase = async (req, res) => {
  try {
    const purchase = await Purchase.create(req);

    if(purchase.status === "error") {
      return res.status(422).json({ error: purchase.message });
    }

    res.json(purchase);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updatePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.update(req);

    res.json(purchase);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.delete(req);

    res.json(purchase);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.totalPurchase = async (req, res) => {
  try {
    const purchase = await Purchase.allPurchase(req);

    res.json(purchase);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.approvePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.approve(req);

    res.json(purchase);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

