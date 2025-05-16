const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase.controller");

router.get("/search", purchaseController.getPurchaseSearch);
router.get("/search_pending", purchaseController.getPendingPurchaseSearch);
router.get("/get_detail", purchaseController.getPurchaseDetail);
router.post("/create", purchaseController.createPurchase);
router.post("/update", purchaseController.updatePurchase);
router.post("/delete/:id", purchaseController.deletePurchase);

module.exports = router;
