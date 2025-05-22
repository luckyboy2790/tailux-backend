const moment = require("moment");
const { v4 } = require("uuid");
const slugify = require("slugify");
const path = require("path");
const db = require("../config/db");
const { putObject } = require("../utils/putObject");

exports.create = async (req) => {
  try {
    // Ensure authenticated user
    if (!req.user || !req.user.id) {
      return {
        status: "Error",
        message: "Unauthorized: User not authenticated",
        code: 401,
      };
    }

    const { date, reference_no, purchase_id, amount = 0, note = "" } = req.body;

    // Validate required fields
    if (!date || !reference_no || !purchase_id) {
      return {
        status: "Error",
        message: "Missing required fields: date, reference_no, or purchase_id",
        code: 422,
      };
    }

    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");
    const userRole = req.user.role || "user";
    const status = userRole !== "secretary" ? 1 : 0;

    // Fetch related purchase, supplier, and company
    const [purchaseRows] = await db.query(
      `
      SELECT p.id, s.company AS supplier_company, c.name AS company_name, p.company_id
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.id = ?
    `,
      [purchase_id]
    );

    if (purchaseRows.length === 0) {
      return {
        status: "Error",
        message: "Purchase not found",
        code: 404,
      };
    }

    const purchase = purchaseRows[0];

    // Verify user has access to this purchase's company (if not admin)
    if (userRole !== "admin" && req.user.company_id !== purchase.company_id) {
      return {
        status: "Error",
        message:
          "You don't have permission to create returns for this purchase",
        code: 403,
      };
    }

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
      const attachName = `returns/${companySlug}_${reference_no}_${purchase_id}_${supplierSlug}_${v4()}${ext}`;

      const { key } = await putObject(file.data, attachName);

      await db.query(
        `
        UPDATE preturns SET attachment = ? WHERE id = ?
      `,
        [`/${key}`, preturnId]
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
      status: "Success",
      data: createdPreturn[0],
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: error.message || "Failed to create preturn",
      code: 500,
    };
  }
};

exports.update = async (req) => {
  try {
    const { id, date, reference_no, amount = 0, note, purchase_id } = req.body;

    if (!id || !date) throw new Error("Missing required fields: id or date");

    const [[preturn]] = await db.query("SELECT * FROM preturns WHERE id = ?", [
      id,
    ]);
    if (!preturn) throw new Error("Preturn not found");

    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");

    await db.query(
      `UPDATE preturns SET timestamp = ?, reference_no = ?, amount = ?, note = ?, updated_at = NOW() WHERE id = ?`,
      [timestamp, reference_no, amount, note, id]
    );

    if (req.files && req.files.attachment) {
      const [[purchase]] = await db.query(
        "SELECT * FROM purchases WHERE id = ?",
        [purchase_id]
      );
      if (!purchase) throw new Error("Purchase not found");

      const [[supplier]] = await db.query(
        "SELECT company FROM suppliers WHERE id = ?",
        [purchase.supplier_id]
      );
      const [[company]] = await db.query(
        "SELECT name FROM companies WHERE id = ?",
        [purchase.company_id]
      );

      const attachName = `${company.name}_${reference_no}_${
        purchase.reference_no
      }_${supplier.company}_${v4()}`;

      const file = req.files.attachment;
      const ext = path.extname(file.name);
      const uploadPath = `returns/${attachName}${ext}`;
      const { key } = await putObject(file.data, uploadPath);

      await db.query(`UPDATE preturns SET attachment = ? WHERE id = ?`, [
        `/${key}`,
        id,
      ]);
    }

    return { status: "success", data: { id } };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
};

exports.delete = async (req) => {
  try {
    const { id } = req.params;
    if (!id) throw new Error("Missing preturn ID");

    await db.query("DELETE FROM preturns WHERE id = ?", [id]);

    return { status: "success" };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
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

exports.approve = async (req) => {
  try {
    const { id } = req.params;

    const [[preturn]] = await db.query("SELECT * FROM preturns WHERE id = ?", [
      id,
    ]);
    if (!preturn) throw new Error("Preturn not found");

    await db.query("UPDATE preturns SET status = 1 WHERE id = ?", [id]);

    return {
      status: "success",
      message: "Preturn approved",
      data: {
        id,
        reference_no: preturn.reference_no,
        amount: preturn.amount,
        status: 1,
      },
    };
  } catch (error) {
    console.error(error);
    return { status: "error", message: error.message };
  }
};
