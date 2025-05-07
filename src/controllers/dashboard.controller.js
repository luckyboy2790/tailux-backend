const Dashboard = require("../models/dashboard.model");

exports.getDashboardData = async (req, res) => {
  try {
    const dashboardData = await Dashboard.getDashboardData(req, res);
    res.json(dashboardData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getExtraDashboardData = async (req, res) => {
  try {
    const data = await Dashboard.getExtraDashboardData(req, res);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getCompanies = async (req, res) => {
  try {
    const data = await Dashboard.getCompanies(req, res);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
