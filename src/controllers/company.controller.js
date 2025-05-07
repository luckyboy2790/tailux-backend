const Company = require("../models/company.model");

exports.getAllCompany = async (req, res) => {
  try {
    const companies = await Company.findAll();
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
