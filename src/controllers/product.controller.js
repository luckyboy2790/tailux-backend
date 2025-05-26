const Product = require("../models/product.model");

exports.getProductsSearch = async (req, res) => {
  try {
    const products = await Product.search(req);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getTotalProducts = async (req, res) => {
  try {
    const products = await Product.getProducts(req);

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req);

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.update(req);

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.delete(req);

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};
