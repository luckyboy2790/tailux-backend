const express = require("express");
const router = express.Router();
const siteSettingController = require("../controllers/siteSetting.controller");

router.get("/get", siteSettingController.getSiteSetting);

module.exports = router;
