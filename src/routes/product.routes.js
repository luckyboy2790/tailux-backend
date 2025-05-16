const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");

router.get("/search", productController.getProductsSearch);
router.get("/get_products", productController.getTotalProducts);

module.exports = router;
