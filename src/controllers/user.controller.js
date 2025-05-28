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

exports.createUser = async (req, res) => {
  try {
    const user = await User.create(req);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.update(req);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.delete(req);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
