const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase.controller");

router.get("/search", purchaseController.getPurchaseSearch);
router.get("/search_pending", purchaseController.getPendingPurchaseSearch);
router.get("/get_detail", purchaseController.getPurchaseDetail);

module.exports = router;
