const express = require("express");
const router = express.Router();
// const userController = require("../controllers/user.controller");
const dashboardController = require("../controllers/dashboard.controller");
const verifyToken = require("../middlewares/authJWT");

router.get("/dashboard-data", verifyToken, dashboardController.getDashboardData);
router.get("/extra-dashboard-data", verifyToken, dashboardController.getExtraDashboardData);
router.get("/get-companies", dashboardController.getCompanies);

module.exports = router;
