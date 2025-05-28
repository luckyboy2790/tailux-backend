const express = require("express");
const router = express.Router();
const storeController = require("../controllers/store.controller");

router.get("/search", storeController.getStoreSearch);
router.get("/get_stores", storeController.getTotalStores);
router.post("/create", storeController.createStore);
router.post("/update", storeController.updateStore);
router.post("/delete/:id", storeController.deleteStore);

module.exports = router;
