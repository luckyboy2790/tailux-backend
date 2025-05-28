const Company = require("../models/company.model");

exports.getAllCompany = async (req, res) => {
  try {
    const companies = await Company.findAll();
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getCompanySearch = async (req, res) => {
  try {
    const companies = await Company.searchCompanies(req);
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.createCompany = async (req, res) => {
  try {
    const company = await Company.create(req);
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const company = await Company.update(req);
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.delete(req);
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
