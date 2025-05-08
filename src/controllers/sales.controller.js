const Sales = require("../models/sales.model");

exports.getSalesSearch = async (req, res) => {
  try {
    const sales = await Sales.searchSales(req, res);
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
