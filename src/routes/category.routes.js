const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");

router.get("/search", categoryController.getCategorySearch);
router.post("/save", categoryController.saveCategory);
router.post("/delete/:id", categoryController.deleteCategory);

module.exports = router;
