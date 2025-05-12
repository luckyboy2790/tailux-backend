const express = require("express");
const router = express.Router();
const preOrderController = require("../controllers/preoder.controller");

router.get("/search", preOrderController.getRecievedOrderSearch);

module.exports = router;
