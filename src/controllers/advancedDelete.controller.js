const AdvancedDelete = require("../models/advancedDelete.model");

exports.sendVerificationCode = async (req, res) => {
  try {
    const authData = await AdvancedDelete.sendVerificationCode(req);

    res.status(200).json(authData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submitAdvancedDelete = async (req, res) => {
  try {
    const authData = await AdvancedDelete.submitAdvancedDelete(req);

    res.status(200).json(authData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
