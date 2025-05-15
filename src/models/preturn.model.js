const moment = require("moment");
const { v4 } = require("uuid");
const slugify = require("slugify");
const path = require("path");
const db = require("../config/db");
const { putObject } = require("../utils/putObject");

exports.create = async (req) => {
  try {
    const { date, reference_no, purchase_id, amount = 0, note = "" } = req.body;

    if (!date || !reference_no || !purchase_id) {
      throw new Error(
        "Missing required fields: date, reference_no, or purchase_id"
      );
    }

    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");
    const userRole = req.user?.role || "user";
    const status = userRole !== "secretary" ? 1 : 0;

    // Fetch related purchase, supplier, and company
    const [purchaseRows] = await db.query(
      `
      SELECT p.id, s.company AS supplier_company, c.name AS company_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.id = ?
    `,
      [purchase_id]
    );

    if (purchaseRows.length === 0) throw new Error("Purchase not found");

    const purchase = purchaseRows[0];
    const companySlug = slugify(purchase.company_name, { lower: true });
    const supplierSlug = slugify(purchase.supplier_company, { lower: true });

    // Insert preturn record
    const [preturnResult] = await db.query(
      `
      INSERT INTO preturns (timestamp, reference_no, amount, purchase_id, note, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
      [timestamp, reference_no, amount, purchase_id, note, status]
    );

    const preturnId = preturnResult.insertId;

    // Upload attachment (single file only as per Laravel version)
    if (req.files && req.files.attachment) {
      const file = req.files.attachment;
      const ext = path.extname(file.name);
      const attachName = `images/returns/${companySlug}_${reference_no}_${purchase_id}_${supplierSlug}_${v4()}${ext}`;

      const { key } = await putObject(file.data, attachName);

      await db.query(
        `
        UPDATE preturns SET attachment = ? WHERE id = ?
      `,
        [key, preturnId]
      );
    }

    // Fetch the full saved model (optionally with joined image paths)
    const [createdPreturn] = await db.query(
      `
      SELECT * FROM preturns WHERE id = ?
    `,
      [preturnId]
    );

    return {
      status: "success",
      data: createdPreturn[0],
    };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message || "Failed to create preturn",
    };
  }
};

exports.search = async (req) => {
  try {
    const { purchase_id } = req.query;

    if (!purchase_id) {
      throw new Error("Missing required query parameter: purchase_id");
    }

    const [preturns] = await db.query(
      `SELECT * FROM preturns WHERE purchase_id = ?`,
      [purchase_id]
    );

    return {
      status: "success",
      data: preturns,
    };
  } catch (error) {
    console.error("searchPreturns error:", error);
    return {
      status: "error",
      message: error.message || "Failed to retrieve preturns",
    };
  }
};
