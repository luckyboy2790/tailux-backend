const express = require("express");
const router = express.Router();
const preturnController = require("../controllers/preturn.controller");

router.post("/create", preturnController.createPreturn);
router.get("/search", preturnController.searchPreturn);

module.exports = router;
