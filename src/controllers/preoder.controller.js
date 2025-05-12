const PreOrder = require("../models/preorder.model");

exports.getPreOrderSearch = async (req, res) => {
  try {
    const preOrders = await PreOrder.searchPreOrders(req.query);
    res.json(preOrders);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getRecievedOrderSearch = async (req, res) => {
  try {
    const receivedOrders = await PreOrder.searchReceivedOrders(req.query);

    res.json(receivedOrders);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
