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
