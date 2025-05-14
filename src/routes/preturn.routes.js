const express = require("express");
const router = express.Router();
const preturnController = require("../controllers/preturn.controller");

router.post("/create", preturnController.createPreturn);

module.exports = router;
