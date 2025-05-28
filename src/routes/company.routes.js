const express = require("express");
const router = express.Router();
const companyController = require("../controllers/company.controller");

router.get("/get_all_company", companyController.getAllCompany);
router.get("/search", companyController.getCompanySearch);
router.post("/create", companyController.createCompany);
router.post("/update", companyController.updateCompany);
router.post("/delete/:id", companyController.deleteCompany);

module.exports = router;
