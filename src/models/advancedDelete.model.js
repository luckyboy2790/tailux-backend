const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { Op } = require("sequelize");
const db = require("../config/db");
const cache = new Map();

exports.sendVerificationCode = async (req) => {
  try {
    const { email, suppliers = [], startDate, endDate } = req.body;
    if (!email) return { success: false, message: "Email required" };

    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    cache.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    let supplierNames = "All Suppliers";

    console.log(suppliers);

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
      port: 587,
      secure: false,
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
          <p style="color: white;"><strong>Date</strong>&nbsp;&nbsp;&nbsp;&nbsp;${startDate} ~ ${endDate}</p>
          <p style="color: white;"><strong>Supplier</strong> ${supplierNames}</p>
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
        query += " AND DATE(timestamp) = ?";
        params.push(startDate);
      } else {
        query += " AND DATE(timestamp) BETWEEN ? AND ?";
        params.push(startDate, endDate);
      }
    }

    if (Array.isArray(suppliers) && suppliers.length > 0) {
      query += ` AND supplier_id IN (${suppliers.map(() => "?").join(",")})`;
      params.push(...suppliers);
    }

    const [purchases] = await db.query(query, params);

    for (const purchase of purchases) {
      if (purchase.total_amount === purchase.paid_amount) {
        await db.query(
          "DELETE FROM orders WHERE orderable_id = ? AND orderable_type = 'App\\\\Models\\\\Purchase'",
          [purchase.id]
        );
        await db.query(
          "DELETE FROM payments WHERE paymentable_id = ? AND paymentable_type = 'App\\\\Models\\\\Purchase'",
          [purchase.id]
        );
        await db.query("DELETE FROM preturns WHERE purchase_id = ?", [
          purchase.id,
        ]);
        await db.query(
          "DELETE FROM images WHERE imageable_id = ? AND imageable_type = 'App\\\\Models\\\\Purchase'",
          [purchase.id]
        );
        await db.query("DELETE FROM purchases WHERE id = ?", [purchase.id]);
      }
    }

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Server error" };
  }
};
