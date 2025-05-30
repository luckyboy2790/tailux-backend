const db = require("../config/db");
const moment = require("moment");
// const { getUserFromAuth } = require("../utils/auth");

async function getAmountAfterReturnsAndPayments(purchaseId) {
  const [[{ returned = 0 }]] = await db.query(
    `SELECT SUM(amount) as returned FROM preturns WHERE status = 1 AND purchase_id = ?`,
    [purchaseId]
  );
  const [[{ paid = 0 }]] = await db.query(
    `SELECT SUM(amount) as paid FROM payments WHERE status = 1 AND paymentable_id = ? AND paymentable_type = 'App\\Models\\Purchase'`,
    [purchaseId]
  );
  return { returned: Number(returned) || 0, paid: Number(paid) || 0 };
}

exports.getDashboardData = async (req) => {
  try {
    const authUser = req.user;

    let companyId = null;
    const [[defaultCompany]] = await db.query(
      "SELECT id FROM companies ORDER BY id ASC LIMIT 1"
    );
    if (!defaultCompany) return { error: "No company found." };

    companyId = defaultCompany.id;
    if (["user", "secretary"].includes(authUser?.role)) {
      companyId = authUser.company_id;
    }
    if (req.query.company_id) {
      companyId = Number(req.query.company_id);
    }

    const startDate = req.query.startDate
      ? moment(req.query.startDate)
      : moment().startOf("month");
    const endDate = req.query.endDate
      ? moment(req.query.endDate)
      : moment().endOf("month");

    const keyArray = [],
      purchaseArray = [],
      saleArray = [],
      paymentArray = [];

    let dt = moment(startDate);
    while (dt.isSameOrBefore(endDate, "day")) {
      const key = dt.format("YYYY-MM-DD");
      keyArray.push(dt.format("MMM/DD"));

      const [[{ total_purchase = 0 }]] = await db.query(
        "SELECT SUM(grand_total) as total_purchase FROM purchases WHERE company_id = ? AND DATE(timestamp) = ?",
        [companyId, key]
      );

      const [[{ total_sale = 0 }]] = await db.query(
        "SELECT SUM(grand_total) as total_sale FROM sales WHERE company_id = ? AND DATE(timestamp) = ?",
        [companyId, key]
      );

      const [[{ total_payment = 0 }]] = await db.query(
        `SELECT SUM(amount) as total_payment FROM payments WHERE status = 1 AND DATE(timestamp) = ? AND paymentable_type = 'App\\\\Models\\\\Purchase'`,
        [key]
      );

      purchaseArray.push(Number(total_purchase));
      saleArray.push(Number(total_sale));
      paymentArray.push(Number(total_payment));

      dt.add(1, "day");
    }

    const where = `AND company_id = ${companyId}`;

    const todayPurchases = await getTodayData("purchases", where);
    const todaySales = await getTodayData("sales", where);
    const weekPurchases = await getWeekData("purchases", where);
    const weekSales = await getWeekData("sales", where);
    const monthPurchases = await getMonthData("purchases", where);

    const after5Day = moment().add(5, "days").format("YYYY-MM-DD");
    const [results] = await db.query(
      `SELECT id, grand_total FROM purchases
       WHERE company_id = ? AND credit_days IS NOT NULL AND expiry_date BETWEEN CURDATE() AND ?`,
      [companyId, after5Day]
    );

    let expiredIn5DaysCount = 0;
    for (const purchase of results) {
      const { returned, paid } = await getAmountAfterReturnsAndPayments(
        purchase.id
      );
      const totalAmount = purchase.grand_total - returned;
      if (totalAmount > paid) expiredIn5DaysCount++;
    }

    const dashboardData = {
      today_purchases: todayPurchases,
      today_sales: todaySales,
      week_purchases: weekPurchases,
      week_sales: weekSales,
      month_purchases: monthPurchases,
      expired_in_5days_purchases: expiredIn5DaysCount,
    };

    return {
      return: dashboardData,
      key_array: keyArray,
      purchase_array: purchaseArray,
      sale_array: saleArray,
      payment_array: paymentArray,
    };
  } catch (error) {
    console.error(error);
    return { error: "Server error" };
  }
};

exports.getExtraDashboardData = async (req, res) => {
  try {
    const authUser = req.user;
    let companyId = null;

    // Fetch the first company (default company)
    const [defaultCompany] = await db.query("SELECT id FROM companies LIMIT 1");
    if (!defaultCompany || defaultCompany.length === 0) {
      return { error: "No company found." };
    }
    companyId = defaultCompany[0].id;

    if (authUser.role === "user" || authUser.role === "secretary") {
      companyId = authUser.company_id;
    }

    if (req.query.company_id) {
      companyId = Number(req.query.company_id);
    }

    const [companyPurchases] = await db.query(
      "SELECT id FROM purchases WHERE company_id = ? AND status = 1",
      [companyId]
    );
    const companyPurchaseIds = companyPurchases.map((purchase) => purchase.id);

    const [[{ grand_total_amount }]] = await db.query(
      "SELECT SUM(grand_total) AS grand_total_amount FROM purchases WHERE company_id = ? AND status = 1",
      [companyId]
    );

    const [[{ return_amount }]] = await db.query(
      "SELECT SUM(amount) AS return_amount FROM preturns WHERE status = 1 AND purchase_id IN (?)",
      [companyPurchaseIds]
    );

    const [[{ paid_amount = 0 }]] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid_amount
      FROM payments
      WHERE status = 1
        AND paymentable_id IN (?)
        AND paymentable_type = ?`,
      [companyPurchaseIds, "App\\Models\\Purchase"]
    );

    const companyBalance = grand_total_amount - return_amount - paid_amount;

    const [expiredPurchases] = await db.query(
      `SELECT
        p.id,
        p.grand_total,
        COALESCE(SUM(py.amount), 0) AS paid_amount,
        COALESCE(SUM(r.amount), 0) AS returned_amount
      FROM purchases p
      LEFT JOIN payments py
        ON py.paymentable_id = p.id
      AND py.paymentable_type = 'App\\\\Models\\\\Purchase'
      AND py.status = 1
      LEFT JOIN preturns r
        ON r.purchase_id = p.id
      AND r.status = 1
      WHERE p.company_id = ?
        AND p.credit_days IS NOT NULL
        AND p.expiry_date <= CURDATE()
      GROUP BY p.id`,
      [companyId]
    );

    const expiredPurchasesCount = expiredPurchases.filter((p) => {
      const totalAmount = p.grand_total - p.returned_amount;
      return totalAmount > p.paid_amount;
    }).length;

    const data = {
      company_balance: companyBalance,
      expired_purchases: expiredPurchasesCount,
    };

    return data;
  } catch (error) {
    console.error("Error fetching extra dashboard data:", error);
    return { error: "Server error" };
  }
};

exports.getCompanies = async (req, res) => {
  const [rows] = await db.query("SELECT id, name FROM companies");
  return rows;
};

async function getTodayData(table, where = "") {
  const [rows] = await db.query(
    `SELECT id FROM ${table} WHERE status = 1 AND TO_DAYS(timestamp) = TO_DAYS(NOW()) ${where}`
  );
  const orderables = rows.map((row) => row.id);
  const count = orderables.length;
  let total = 0;

  if (count > 0) {
    const [totalResult] = await db.query(
      `SELECT SUM(subtotal) as total FROM orders WHERE orderable_id IN (?) AND orderable_type = ?`,
      [
        orderables,
        table === "purchases" ? "App\\Models\\Purchase" : "App\\Models\\Sale",
      ]
    );
    total = totalResult[0]?.total || 0;
  }

  return {
    count,
    total,
  };
}

async function getWeekData(table, where = "") {
  const [rows] = await db.query(
    `SELECT id FROM ${table} WHERE status = 1 AND YEARWEEK(DATE_FORMAT(timestamp, '%Y-%m-%d')) = YEARWEEK(NOW()) ${where}`
  );
  const orderables = rows.map((row) => row.id);
  const count = orderables.length;
  let total = 0;

  if (count > 0) {
    const [totalResult] = await db.query(
      `SELECT SUM(subtotal) as total FROM orders WHERE orderable_id IN (?) AND orderable_type = ?`,
      [
        orderables,
        table === "purchases" ? "App\\Models\\Purchase" : "App\\Models\\Sale",
      ]
    );
    total = totalResult[0]?.total || 0;
  }

  return {
    count,
    total,
  };
}

async function getMonthData(table, where = "") {
  const [rows] = await db.query(
    `SELECT id FROM ${table} WHERE status = 1 AND DATE_FORMAT(timestamp, '%Y%m') = DATE_FORMAT(CURDATE(), '%Y%m') ${where}`
  );
  const orderables = rows.map((row) => row.id);
  const count = orderables.length;
  let total = 0;

  if (count > 0) {
    const [totalResult] = await db.query(
      `SELECT SUM(subtotal) as total FROM orders WHERE orderable_id IN (?) AND orderable_type = ?`,
      [
        orderables,
        table === "purchases" ? "App\\Models\\Purchase" : "App\\Models\\Sale",
      ]
    );
    total = totalResult[0]?.total || 0;
  }

  return {
    count,
    total,
  };
}
