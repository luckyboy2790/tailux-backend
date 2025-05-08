const express = require("express");
const router = express.Router();
const salesController = require("../controllers/sales.controller");

router.get("/search", salesController.getSalesSearch);

module.exports = router;
