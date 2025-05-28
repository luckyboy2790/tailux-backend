const Supplier = require("../models/supplier.model");

exports.getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getSupplierSearch = async (req, res) => {
  try {
    const suppliers = await Supplier.searchSuppliers(req);

    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const purchases = await Supplier.getPurchases(req);

    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.create(req);
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.update(req);
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.delete(req);
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

