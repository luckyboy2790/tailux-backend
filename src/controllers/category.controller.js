const Category = require("../models/category.model");

exports.getCategorySearch = async (req, res) => {
  try {
    const categories = await Category.searchCategories(req);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.saveCategory = async (req, res) => {
  try {
    const category = await Category.saveCategory(req);
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.deleteCategory(req);
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
