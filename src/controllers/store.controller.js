const Store = require("../models/store.model");

exports.getStoreSearch = async (req, res) => {
  try {
    const store = await Store.searchStores(req);
    res.json(store);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
