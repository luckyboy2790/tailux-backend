const Auth = require("../models/auth.model");

exports.login = async (req, res) => {
  try {
    const authData = await Auth.login(req);

    res.status(200).json(authData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.checkOTP = async (req, res) => {
  try {
    const authData = await Auth.checkOTP(req);

    res.status(200).json(authData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = req.user;

    console.log(user);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
