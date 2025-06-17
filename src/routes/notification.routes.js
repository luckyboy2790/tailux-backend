const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const verifyToken = require("../middlewares/authJWT");

router.get(
  "/get_notifications",
  verifyToken,
  notificationController.getNotifications
);
router.get("/search", verifyToken, notificationController.searchNotifications);
router.post(
  "/delete_notification/:id",
  verifyToken,
  notificationController.deleteNotification
);
router.post(
  "/delete_all_notifications",
  verifyToken,
  notificationController.deleteAllNotifications
);

module.exports = router;
