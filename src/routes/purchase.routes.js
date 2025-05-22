const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase.controller");

const verifyToken = require("../middlewares/authJWT");

router.get("/search", verifyToken, purchaseController.getPurchaseSearch);
router.get(
  "/search_pending",
  verifyToken,
  purchaseController.getPendingPurchaseSearch
);
router.get("/get_detail", verifyToken, purchaseController.getPurchaseDetail);
router.post("/create", verifyToken, purchaseController.createPurchase);
router.post("/update", verifyToken, purchaseController.updatePurchase);
router.post("/delete/:id", verifyToken, purchaseController.deletePurchase);
router.get("/get_all", verifyToken, purchaseController.totalPurchase);

module.exports = router;
