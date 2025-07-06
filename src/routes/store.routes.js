const express = require("express");
const router = express.Router();
const storeController = require("../controllers/store.controller");
const verifyToken = require("../middlewares/authJWT");

router.get("/search", storeController.getStoreSearch);
router.get("/get_stores", verifyToken, storeController.getTotalStores);
router.post("/create", storeController.createStore);
router.post("/update", storeController.updateStore);
router.post("/delete/:id", storeController.deleteStore);

module.exports = router;
