const Notification = require("../models/notification.model");

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.getNotifications(req);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.searchNotifications = async (req, res) => {
  try {
    const notifications = await Notification.searchNotifications(req);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.deleteNotification(req);
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteAllNotifications = async (req, res) => {
  try {
    const notification = await Notification.deleteAllNotifications(req);
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
