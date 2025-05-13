const express = require("express");
const router = express.Router();
const companyController = require("../controllers/company.controller");

router.get("/get_all_company", companyController.getAllCompany);
router.get("/search", companyController.getCompanySearch);

module.exports = router;
