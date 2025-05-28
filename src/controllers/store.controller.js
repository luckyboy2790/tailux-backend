const Store = require("../models/store.model");

exports.getStoreSearch = async (req, res) => {
  try {
    const store = await Store.searchStores(req);
    res.json(store);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getTotalStores = async (req, res) => {
  try {
    const store = await Store.getStores(req);

    res.json(store);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.createStore = async (req, res) => {
  try {
    const store = await Store.create(req);
    res.json(store);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updateStore = async (req, res) => {
  try {
    const store = await Store.update(req);
    res.json(store);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteStore = async (req, res) => {
  try {
    const store = await Store.delete(req);
    res.json(store);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

