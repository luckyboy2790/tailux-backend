const express = require("express");
const router = express.Router();
const preOrderController = require("../controllers/preoder.controller");
const verifyToken = require("../middlewares/authJWT");

router.get("/search", verifyToken, preOrderController.getPreOrderSearch);
router.post("/create", verifyToken, preOrderController.createPreOrder);
router.post("/update", verifyToken, preOrderController.updatePreOrder);
router.post("/delete/:id", verifyToken, preOrderController.deletePreOrder);
router.post("/receive", verifyToken, preOrderController.receivePreOrder);
router.get(
  "/get_detail/:id",
  verifyToken,
  preOrderController.getPreOrderDetail
);
router.get("/serach_recieved", preOrderController.getRecievedOrderSearch);

module.exports = router;
