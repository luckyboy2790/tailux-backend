const express = require("express");
const router = express.Router();
const salesController = require("../controllers/sales.controller");
const verifyToken = require("../middlewares/authJWT");

router.get("/search", verifyToken, salesController.getSalesSearch);
router.get("/get_detail", salesController.getSaleDetail);
router.post("/create", verifyToken, salesController.createSale);
router.post("/update", verifyToken, salesController.updateSale);
router.post("/delete/:id", salesController.deleteSale);

module.exports = router;
