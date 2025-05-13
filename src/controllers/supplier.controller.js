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
