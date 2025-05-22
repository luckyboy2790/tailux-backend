const express = require("express");
const router = express.Router();
const preturnController = require("../controllers/preturn.controller");

const verifyToken = require("../middlewares/authJWT");

router.post("/create", verifyToken, preturnController.createPreturn);
router.post("/update", verifyToken, preturnController.updatePreturn);
router.post("/delete/:id", verifyToken, preturnController.deletePreturn);
router.get("/search", verifyToken, preturnController.searchPreturn);
router.post("/approve/:id", verifyToken, preturnController.approvePreturn);

module.exports = router;
