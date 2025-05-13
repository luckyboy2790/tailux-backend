const Customer = require("../models/customer.model");

exports.getAllCustomers = async (req, res) => {
  try {
    const customer = await Customer.findAll();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getCustomersSearch = async (req, res) => {
  try {
    const customer = await Customer.searchCustomers(req);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
