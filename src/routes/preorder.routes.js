const express = require("express");
const router = express.Router();
const preOrderController = require("../controllers/preoder.controller");
const verifyToken = require("../middlewares/authJWT");

router.get("/search", verifyToken, preOrderController.getPreOrderSearch);
router.get("/serach_recieved", preOrderController.getRecievedOrderSearch);

module.exports = router;
