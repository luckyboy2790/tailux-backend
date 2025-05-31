const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const verifyToken = require("../middlewares/authJWT");

router.get("/", userController.getAllUsers);
router.get("/search", userController.getUsersSearch);
router.post("/create", userController.createUser);
router.post("/update", userController.updateUser);
router.post("/delete/:id", userController.deleteUser);
router.post("/update_profile", verifyToken, userController.updateProfile);
router.post("/update_password", verifyToken, userController.updatePassword);

module.exports = router;
