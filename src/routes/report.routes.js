const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");

router.get("/overview_chart", reportController.getOverviewChartSearch);
router.get("/company_chart", reportController.getCompanyChartSearch);
router.get("/store_chart", reportController.getStoreChartSearch);
router.get(
  "/product_quantity_alert",
  reportController.getProductQuantityAlertSearch
);
router.get(
  "/product_expiry_alert",
  reportController.getProductExpiryAlertSearch
);
router.get("/product", reportController.getProductReportSearch);
router.get(
  "/expired_purchases_report",
  reportController.getExpiredPurchasesReportSearch
);
router.get("/sales", reportController.getSalesReportSearch);
router.get("/purchases", reportController.getPurchasesReportSearch);
router.get("/payments", reportController.getPaymentsReportSearch);
router.get("/customers", reportController.getCustomersReportSearch);
router.get("/suppliers", reportController.getSuppliersReportSearch);
router.get("/users", reportController.getUsersReportSearch);

module.exports = router;
