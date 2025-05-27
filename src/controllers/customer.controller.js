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

exports.createCustomer = async (req, res) => {
  try {
    const customer = await Customer.create(req);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.update(req);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.delete(req);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
