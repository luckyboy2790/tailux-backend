const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { Op } = require("sequelize");
const db = require("../config/db");
const cache = new Map();

exports.sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email required" });

    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    cache.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

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
      html: `<p>Your verification code is: <b>${code}</b></p>`,
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

    if (suppliers?.length) {
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
