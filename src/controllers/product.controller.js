const Product = require("../models/product.model");

exports.getProductsSearch = async (req, res) => {
  try {
    const products = await Product.search(req);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
