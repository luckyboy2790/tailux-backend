const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const verifyToken = require("../middlewares/authJWT");

router.get(
  "/overview_chart",
  verifyToken,
  reportController.getOverviewChartSearch
);
router.get(
  "/company_chart",
  verifyToken,
  reportController.getCompanyChartSearch
);
router.get("/store_chart", verifyToken, reportController.getStoreChartSearch);
router.get(
  "/product_quantity_alert",
  reportController.getProductQuantityAlertSearch
);
router.get(
  "/product_expiry_alert",
  verifyToken,
  reportController.getProductExpiryAlertSearch
);
router.get("/product", reportController.getProductReportSearch);
router.get(
  "/expired_purchases_report",
  verifyToken,
  reportController.getExpiredPurchasesReportSearch
);
router.get("/sales", verifyToken, reportController.getSalesReportSearch);
router.get(
  "/purchases",
  verifyToken,
  reportController.getPurchasesReportSearch
);
router.get("/payments", verifyToken, reportController.getPaymentsReportSearch);
router.get("/customers", reportController.getCustomersReportSearch);
router.get("/suppliers", reportController.getSuppliersReportSearch);
router.get("/users", verifyToken, reportController.getUsersReportSearch);

module.exports = router;
