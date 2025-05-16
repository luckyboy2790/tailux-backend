const express = require("express");
const router = express.Router();
const storeController = require("../controllers/store.controller");

router.get("/search", storeController.getStoreSearch);
router.get("/get_stores", storeController.getTotalStores);

module.exports = router;
