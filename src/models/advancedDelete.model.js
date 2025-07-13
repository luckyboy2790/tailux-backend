const crypto = require("crypto");
const nodemailer = require("nodemailer");
const db = require("../config/db");
const cache = new Map();

exports.sendVerificationCode = async (req) => {
  try {
    const { email, suppliers = [], startDate, endDate } = req.body;
    if (!email) return { success: false, message: "Email required" };

    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    cache.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    let supplierNames = "All Suppliers";

    if (Array.isArray(suppliers) && suppliers.length > 0) {
      const [results] = await db.query(
        `SELECT name FROM suppliers WHERE id IN (${suppliers
          .map(() => "?")
          .join(",")})`,
        suppliers
      );
      supplierNames = results.map((s) => s.name).join(", ");
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: "admin@doradanew.fun",
      to: email,
      subject: "Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; color: #ffffff; background-color: #1c1c1c; padding: 20px;">
          <h2 style="color: white;">Hello, Please verify with code.</h2>
          <p style="font-size: 24px; font-weight: bold; color: white;">${code}</p>

          <h3 style="margin-top: 30px; color: white;">Your Requested Data</h3>
          <p style="color: white;"><strong style="margin-right: 15px;">Date</strong>&nbsp;&nbsp;&nbsp;&nbsp;${startDate} ~ ${endDate}</p>
          <p style="color: white;"><strong style="margin-right: 15px;">Supplier</strong> ${supplierNames}</p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Failed to send verification code" };
  }
};

exports.submitAdvancedDelete = async (req) => {
  const { email, code, startDate, endDate, suppliers } = req.body;

  const cached = cache.get(email);
  if (!cached || cached.code !== code || Date.now() > cached.expiresAt) {
    return { success: false, message: "Invalid or expired code" };
  }

  cache.delete(email);

  try {
    let query = "SELECT * FROM purchases WHERE 1=1";
    const params = [];

    if (startDate && endDate) {
      if (startDate === endDate) {
        query += " AND timestamp BETWEEN ? AND ?";
        params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
      } else {
        query += " AND timestamp BETWEEN ? AND ?";
        params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
      }
    }

    if (Array.isArray(suppliers) && suppliers.length > 0) {
      query += ` AND supplier_id IN (${suppliers.map(() => "?").join(",")})`;
      params.push(...suppliers);
    }

    const [purchases] = await db.query(query, params);

    const purchaseIds = purchases.map((p) => p.id);
    if (!purchaseIds.length) return { success: true };

    const [payments] = await db.query(
      `
      SELECT paymentable_id AS purchase_id, amount
      FROM payments
      WHERE paymentable_type = 'App\\\\Models\\\\Purchase'
        AND status = 1
        AND paymentable_id IN (${purchaseIds.map(() => "?").join(",")})
    `,
      purchaseIds
    );

    const [preturns] = await db.query(
      `
        SELECT purchase_id, amount
        FROM preturns
        WHERE purchase_id IN (${purchaseIds.map(() => "?").join(",")})
      `,
      purchaseIds
    );

    const groupSum = (rows, key) => {
      const result = {};
      for (const row of rows) {
        if (!result[row[key]]) result[row[key]] = 0;
        result[row[key]] += parseFloat(row.amount || 0);
      }
      return result;
    };

    const paymentMap = groupSum(payments, "purchase_id");
    const preturnMap = groupSum(preturns, "purchase_id");

    for (const purchase of purchases) {
      const paid = paymentMap[purchase.id.toString()] || 0;

      const returned = preturnMap[purchase.id.toString()] || 0;

      const _cost = Number(purchase.grand_total) - returned;

      let discountValue = 0;
      if (
        typeof purchase.discount_string === "string" &&
        purchase.discount_string.trim().endsWith("%")
      ) {
        const percent = Number(
          purchase.discount_string.trim().replace("%", "")
        );
        if (!isNaN(percent)) discountValue = (_cost * percent) / 100;
      } else {
        const flat = Number(purchase.discount_string);
        if (!isNaN(flat)) discountValue = flat;
      }

      if (_cost - discountValue + Number(purchase.shipping) <= paid) {
        await db.query(
          "DELETE FROM orders WHERE orderable_id = ? AND orderable_type = 'App\\\\Models\\\\Purchase'",
          [purchase.id]
        );
        await db.query(
          "DELETE FROM payments WHERE paymentable_id = ? AND paymentable_type = 'App\\\\Models\\\\Purchase'",
          [purchase.id]
        );
        await db.query(
          "DELETE FROM images WHERE imageable_id = ? AND imageable_type = 'App\\\\Models\\\\Purchase'",
          [purchase.id]
        );
        await db.query("DELETE FROM purchases WHERE id = ?", [purchase.id]);
      } else continue;
    }

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Server error" };
  }
};
