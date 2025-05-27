const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer.controller");

router.get("/get_all_customers", customerController.getAllCustomers);
router.get("/search", customerController.getCustomersSearch);
router.post("/create", customerController.createCustomer);
router.post("/update", customerController.updateCustomer);
router.post("/delete/:id", customerController.deleteCustomer);

module.exports = router;
