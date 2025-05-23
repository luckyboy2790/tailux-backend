const User = require("../models/user.model");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.getUsersSearch = async (req, res) => {
  try {
    const users = await User.searchUsers(req);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
