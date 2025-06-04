const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier.controller");
const verifyToken = require("../middlewares/authJWT");

router.get("/get_all_suppliers", supplierController.getAllSuppliers);
router.get("/search", supplierController.getSupplierSearch);
router.get("/get_purchases", verifyToken, supplierController.getPurchases);
router.post("/create", supplierController.createSupplier);
router.post("/update", supplierController.updateSupplier);
router.post("/delete/:id", supplierController.deleteSupplier);

module.exports = router;
