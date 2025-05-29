const SiteSetting = require("../models/siteSetting.model");

exports.getSiteSetting = async (req, res) => {
  try {
    const { key } = req.query;
    const siteSetting = await SiteSetting.getSetting(key);
    res.json(siteSetting);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.setSiteStatus = async (req, res) => {
  try {
    const siteSetting = await SiteSetting.setSetting(req);
    res.json(siteSetting);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.enableSiteStatus = async (req, res) => {
  try {
    const siteSetting = await SiteSetting.enableSiteStatus(req);
    res.json(siteSetting);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.disableSiteStatus = async (req, res) => {
  try {
    const siteSetting = await SiteSetting.disableSiteStatus(req);
    res.json(siteSetting);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getSiteStatus = async (req, res) => {
  try {
    const siteSetting = await SiteSetting.getSiteStatus();
    res.json(siteSetting);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getDisableTime = async (req, res) => {
  try {
    const siteSetting = await SiteSetting.getDisableTime();
    res.json(siteSetting);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
