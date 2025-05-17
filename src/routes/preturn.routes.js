const express = require("express");
const router = express.Router();
const preturnController = require("../controllers/preturn.controller");

router.post("/create", preturnController.createPreturn);
router.post("/update", preturnController.updatePreturn);
router.post("/delete/:id", preturnController.deletePreturn);
router.get("/search", preturnController.searchPreturn);
router.post("/approve", preturnController.approvePreturn);

module.exports = router;
