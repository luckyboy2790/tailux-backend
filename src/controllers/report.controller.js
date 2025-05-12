const Report = require("../models/report.model");

exports.getOverviewChartSearch = async (req, res) => {
  try {
    const overviewData = await Report.getOverviewChartData(req);
    res.json(overviewData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getCompanyChartSearch = async (req, res) => {
  try {
    const companyData = await Report.getCompanyChartData(req);
    res.json(companyData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getStoreChartSearch = async (req, res) => {
  try {
    const storeData = await Report.getStoreChartData(req);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getProductQuantityAlertSearch = async (req, res) => {
  try {
    const storeData = await Report.getProductQuantityAlert(req);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getProductExpiryAlertSearch = async (req, res) => {
  try {
    const storeData = await Report.getProductExpiryAlert(req);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getProductReportSearch = async (req, res) => {
  try {
    const storeData = await Report.getProductsReport(req);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getExpiredPurchasesReportSearch = async (req, res) => {
  try {
    const storeData = await Report.getExpiredPurchasesReport(req.query);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getSalesReportSearch = async (req, res) => {
  try {
    const storeData = await Report.getSalesReport(req);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getPurchasesReportSearch = async (req, res) => {
  try {
    const storeData = await Report.getPurchasesReport(req);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getPaymentsReportSearch = async (req, res) => {
  try {
    const storeData = await Report.getPaymentsReport(req.query);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getCustomersReportSearch = async (req, res) => {
  try {
    const storeData = await Report.getCustomersReport(req.query);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getSuppliersReportSearch = async (req, res) => {
  try {
    const storeData = await Report.getSuppliersReport(req.query);
    res.json(storeData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
