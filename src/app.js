const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

app.use(express.json());

app.use((req, res, next) => {
  console.log(`\x1b[42m ${req.method} ${req.url} request received.\x1b[0m`);
  next();
});

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

app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/product", productRoutes);

module.exports = app;
