const express = require("express");
const router = express.Router();
const siteSettingController = require("../controllers/siteSetting.controller");
const verifyToken = require("../middlewares/authJWT");

router.get("/get", siteSettingController.getSiteSetting);
router.post("/set", siteSettingController.setSiteStatus);
router.post("/enable", siteSettingController.enableSiteStatus);
router.post("/disable", verifyToken, siteSettingController.disableSiteStatus);
router.get("/status", siteSettingController.getSiteStatus);
router.get("/disable_time", siteSettingController.getDisableTime);

module.exports = router;
