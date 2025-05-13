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
