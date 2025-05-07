const db = require("../config/db");
const moment = require("moment");
// const { getUserFromAuth } = require("../utils/auth");

exports.getDashboardData = async (req, res) => {
  try {
    // const authUser = await getUserFromAuth(req);

    let companyId = null;
    const [defaultCompany] = await db.query("SELECT id FROM companies LIMIT 1");
    if (!defaultCompany || defaultCompany.length === 0) {
      return { error: "No company found." };
    }
    companyId = defaultCompany[0].id;

    // if (authUser.role === "user" || authUser.role === "secretary") {
    //   const [[{ id: userCompanyId } = {}]] = await db.query(
    //     "SELECT id FROM companies WHERE id = ?",
    //     [authUser.company_id]
    //   );
    //   if (userCompanyId) companyId = userCompanyId;
    // }

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
      const key = dt.format("YYYY-MM-DD") + " 00:00:00";
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
        `SELECT SUM(amount) as total_payment FROM payments
         WHERE DATE(timestamp) = ? AND paymentable_type = 'App\\Models\\Purchase'`,
        [key]
      );

      purchaseArray.push(Number(total_purchase) || 0);
      saleArray.push(Number(total_sale) || 0);
      paymentArray.push(Number(total_payment) || 0);

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
      `SELECT p.id, p.grand_total, COALESCE(SUM(py.amount), 0) as paid_amount
      FROM purchases p
      LEFT JOIN payments py ON py.paymentable_id = p.id
        AND py.paymentable_type = 'App\\Models\\Purchase'
      WHERE p.company_id = ?
        AND p.credit_days IS NOT NULL
        AND p.expiry_date BETWEEN CURDATE() AND ?
      GROUP BY p.id, p.grand_total
      HAVING p.grand_total > paid_amount`,
      [companyId, after5Day]
    );

    const expiredIn5DaysCount = results.length;

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
    // const authUser = await getUserFromAuth(req);
    let companyId = null;

    // Fetch the first company (default company)
    const [defaultCompany] = await db.query("SELECT id FROM companies LIMIT 1");
    if (!defaultCompany || defaultCompany.length === 0) {
      return { error: "No company found." };
    }
    companyId = defaultCompany[0].id;

    // if (authUser.role === "user" || authUser.role === "secretary") {
    //   companyId = authUser.company_id;
    // }

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
        IFNULL(SUM(pay.amount), 0) AS paid_amount
      FROM purchases p
      LEFT JOIN payments pay
        ON pay.paymentable_id = p.id
        AND pay.paymentable_type = 'App\\\\Models\\\\Purchase'
      WHERE p.company_id = ?
        AND p.credit_days IS NOT NULL
        AND p.expiry_date <= CURDATE()
      GROUP BY p.id`,
      [companyId]
    );

    const expiredPurchasesCount = expiredPurchases.filter(
      (purchase) => purchase.grand_total > purchase.paid_amount
    ).length;

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
    `SELECT id FROM ${table} WHERE TO_DAYS(timestamp) = TO_DAYS(NOW()) ${where}`
  );
  const orderables = rows.map((row) => row.id);
  const count = orderables.length;
  let total = 0;

  if (count > 0) {
    // Only run the query if there are orderable IDs
    if (table === "purchases") {
      const [totalResult] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders WHERE orderable_id IN (?) AND orderable_type = 'Purchase'`,
        [orderables]
      );
      total = totalResult[0]?.total || 0;
    } else if (table === "sales") {
      const [totalResult] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders WHERE orderable_id IN (?) AND orderable_type = 'Sale'`,
        [orderables]
      );
      total = totalResult[0]?.total || 0;
    }
  }

  return {
    count,
    total,
  };
}

async function getWeekData(table, where = "") {
  const [rows] = await db.query(
    `SELECT id FROM ${table} WHERE YEARWEEK(DATE_FORMAT(timestamp, '%Y-%m-%d')) = YEARWEEK(NOW()) ${where}`
  );

  const orderables = rows.map((row) => row.id);
  const count = orderables.length;
  let total = 0;

  if (count > 0) {
    if (table === "purchases") {
      const [totalResult] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders WHERE orderable_id IN (?) AND orderable_type = 'Purchase'`,
        [orderables]
      );
      total = totalResult[0]?.total || 0;
    } else if (table === "sales") {
      const [totalResult] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders WHERE orderable_id IN (?) AND orderable_type = 'Sale'`,
        [orderables]
      );
      total = totalResult[0]?.total || 0;
    }
  }

  return {
    count,
    total,
  };
}

async function getMonthData(table, where = "") {
  const [rows] = await db.query(
    `SELECT id FROM ${table} WHERE DATE_FORMAT(timestamp, '%Y%m') = DATE_FORMAT(CURDATE(), '%Y%m') ${where}`
  );
  const orderables = rows.map((row) => row.id);
  const count = orderables.length;
  let total = 0;

  if (count > 0) {
    // Only run the query if there are orderable IDs
    if (table === "purchases") {
      const [totalResult] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders WHERE orderable_id IN (?) AND orderable_type = 'Purchase'`,
        [orderables]
      );
      total = totalResult[0]?.total || 0;
    } else if (table === "sales") {
      const [totalResult] = await db.query(
        `SELECT SUM(subtotal) as total FROM orders WHERE orderable_id IN (?) AND orderable_type = 'Sale'`,
        [orderables]
      );
      total = totalResult[0]?.total || 0;
    }
  }

  return {
    count,
    total,
  };
}
