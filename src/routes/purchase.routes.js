const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase.controller");

router.get("/search", purchaseController.getPurchaseSearch);

module.exports = router;
