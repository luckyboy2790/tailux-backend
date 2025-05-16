const Purchase = require("../models/purchase.model");

exports.getPurchaseSearch = async (req, res) => {
  try {
    const purchases = await Purchase.searchPurchases(req.query);
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

    res.json(purchase);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
