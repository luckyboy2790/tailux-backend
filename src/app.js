const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const app = express();

app.use(cors());

app.use(express.json());

app.use((req, res, next) => {
  console.log(`\x1b[42m ${req.method} ${req.url} request received.\x1b[0m`);
  next();
});

app.use(fileUpload());

// Routes
const userRoutes = require("./routes/user.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const purchaseRoutes = require("./routes/purchase.routes");
const companyRoutes = require("./routes/company.routes");
const supplierRoutes = require("./routes/supplier.routes");
const saleRoutes = require("./routes/sales.routes");
const customerRoutes = require("./routes/customer.routes");
const paymentRoutes = require("./routes/payment.routes");
const productRoutes = require("./routes/product.routes");
const preOrderRoutes = require("./routes/preorder.routes");
const receivedOrderRoutes = require("./routes/receivedOrder.routes");
const reportRoutes = require("./routes/report.routes");
const storeRoutes = require("./routes/store.routes");
const siteSettingRoutes = require("./routes/siteSetting.route");
const preturnRoutes = require("./routes/preturn.routes");
const authRoutes = require("./routes/auth.routes");
const advancedDeleteRoutes = require("./routes/advancedDelete.routes");

app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/product", productRoutes);
app.use("/api/purchase_order", preOrderRoutes);
app.use("/api/recieved_order", receivedOrderRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/site_setting", siteSettingRoutes);
app.use("/api/preturn", preturnRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/advanced_delete", advancedDeleteRoutes);

module.exports = app;
