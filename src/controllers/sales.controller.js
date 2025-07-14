const Sales = require("../models/sales.model");

exports.getSalesSearch = async (req, res) => {
  try {
    const sales = await Sales.searchSales(req, res);
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getSaleDetail = async (req, res) => {
  try {
    const sales = await Sales.getSaleDetail(req);

    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.createSale = async (req, res) => {
  try {
    const sale = await Sales.create(req);

    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updateSale = async (req, res) => {
  try {
    const sale = await Sales.update(req);

    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sales.delete(req);

    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.totalSales = async (req, res) => {
  try {
    const sales = await Sales.allSales(req);

    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.approveSale = async (req, res) => {
  try {
    const sale = await Sales.approve(req);

    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};
