const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier.controller");

router.get("/get_all_suppliers", supplierController.getAllSuppliers);
router.get("/search", supplierController.getSupplierSearch);
router.get("/get_purchases", supplierController.getPurchases);

module.exports = router;
