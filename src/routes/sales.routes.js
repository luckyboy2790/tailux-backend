const express = require("express");
const router = express.Router();
const salesController = require("../controllers/sales.controller");

router.get("/search", salesController.getSalesSearch);
router.get("/get_detail", salesController.getSaleDetail);
router.post("/delete/:id", salesController.deleteSale);

module.exports = router;
