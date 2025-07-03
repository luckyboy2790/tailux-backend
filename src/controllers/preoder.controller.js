const PreOrder = require("../models/preorder.model");

exports.getPreOrderSearch = async (req, res) => {
  try {
    const preOrders = await PreOrder.searchPurchaseOrders(req);
    res.json(preOrders);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.createPreOrder = async (req, res) => {
  try {
    const preOrder = await PreOrder.create(req);
    res.json(preOrder);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updatePreOrder = async (req, res) => {
  try {
    const preOrder = await PreOrder.update(req);
    res.json(preOrder);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deletePreOrder = async (req, res) => {
  try {
    const preOrder = await PreOrder.delete(req);

    if (preOrder.status === "error") {
      res.status(500).json({ error: preOrder.message });

      return;
    }

    res.json(preOrder);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.receivePreOrder = async (req, res) => {
  try {
    const preOrder = await PreOrder.receive(req);
    res.json(preOrder);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getPreOrderDetail = async (req, res) => {
  try {
    const preOrder = await PreOrder.getPurchaseOrderDetail(req);
    res.json(preOrder);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getRecievedOrderSearch = async (req, res) => {
  try {
    const receivedOrders = await PreOrder.searchReceivedOrders(req);

    res.json(receivedOrders);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getReceivedOrderDetail = async (req, res) => {
  try {
    const receivedOrder = await PreOrder.getReceivedOrderDetail(req);
    res.json(receivedOrder);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updateReceivedPurchase = async (req, res) => {
  try {
    const receivedOrder = await PreOrder.updateReceivedOrder(req);
    res.json(receivedOrder);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteReceivedOrder = async (req, res) => {
  try {
    const receivedOrder = await PreOrder.deleteReceivedOrder(req);
    res.json(receivedOrder);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
