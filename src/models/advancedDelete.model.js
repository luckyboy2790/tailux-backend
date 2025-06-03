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

  console.log(cached);

  cache.delete(email);

  try {
    let whereClause = {};

    if (startDate && endDate) {
      whereClause.timestamp =
        startDate === endDate
          ? startDate
          : { [Op.between]: [startDate, endDate] };
    }

    if (suppliers?.length) {
      whereClause.supplier_id = { [Op.in]: suppliers };
    }

    const purchases = await db("purchases").where(whereClause);

    // for (const purchase of purchases) {
    //   if (purchase.total_amount === purchase.paid_amount) {
    //     await db("orders").where("purchase_id", purchase.id).del();
    //     await db("payments")
    //       .where("paymentable_id", purchase.id)
    //       .andWhere("paymentable_type", "Purchase")
    //       .del();
    //     await db("preturns").where("purchase_id", purchase.id).del();
    //     await db("purchase_images").where("purchase_id", purchase.id).del();
    //     await db("purchases").where("id", purchase.id).del();
    //   }
    // }

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Server error" };
  }
};
