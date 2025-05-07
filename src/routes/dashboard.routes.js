const express = require("express");
const router = express.Router();
// const userController = require("../controllers/user.controller");
const dashboardController = require("../controllers/dashboard.controller");

router.get("/dashboard-data", dashboardController.getDashboardData);
router.get("/extra-dashboard-data", dashboardController.getExtraDashboardData);
router.get("/get-companies", dashboardController.getCompanies);

module.exports = router;
