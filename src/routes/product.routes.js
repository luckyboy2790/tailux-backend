const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const verifyToken = require("../middlewares/authJWT");

router.get("/search", verifyToken, productController.getProductsSearch);
router.get("/get_products", productController.getTotalProducts);
router.post("/create", verifyToken, productController.createProduct);
router.post("/update", verifyToken, productController.updateProduct);
router.post("/delete/:id", verifyToken, productController.deleteProduct);

module.exports = router;
