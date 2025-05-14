const moment = require("moment");
const db = require("../config/db");
const { putObject } = require("../utils/putObject");
const slugify = require("slugify");
const { v4 } = require("uuid");
const path = require("path");

exports.searchPending = async (req, res) => {
  try {
    const {
      page = 1,
      per_page = 10,
      company_id = "",
      reference_no = "",
      startDate = "",
      sort_by_date = "desc",
      endDate = "",
    } = req.query;

    let query = `
      SELECT p.*,
      pu.id as companyID
      FROM payments p
      LEFT JOIN purchases pu ON p.paymentable_id = pu.id AND p.paymentable_type = 'App\\\\Models\\\\Purchase'
      LEFT JOIN sales sa ON p.paymentable_id = sa.id AND p.paymentable_type = 'App\\\\Models\\\\Sale'
      WHERE p.status = 0
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM payments p
      LEFT JOIN purchases pu ON p.paymentable_id = pu.id AND p.paymentable_type = 'App\\\\Models\\\\Purchase'
      LEFT JOIN sales sa ON p.paymentable_id = sa.id AND p.paymentable_type = 'App\\\\Models\\\\Sale'
      WHERE p.status = 0
    `;

    const params = [];
    const countParams = [];

    if (company_id) {
      query += ` AND (pu.company_id = ? OR sa.company_id = ?)`;
      countQuery += ` AND (pu.company_id = ? OR sa.company_id = ?)`;

      params.push(company_id, company_id);
      countParams.push(company_id, company_id);
    }

    if (reference_no) {
      query += ` AND p.reference_no LIKE ?`;
      countQuery += ` AND p.reference_no LIKE ?`;
      params.push(`%${reference_no}%`);
      countParams.push(`%${reference_no}%`);
    }

    if (startDate && endDate) {
      if (startDate === endDate) {
        query += ` AND DATE(p.timestamp) = ?`;
        countQuery += ` AND DATE(p.timestamp) = ?`;
        params.push(startDate);
        countParams.push(startDate);
      } else {
        query += ` AND p.timestamp BETWEEN ? AND ?`;
        countQuery += ` AND p.timestamp BETWEEN ? AND ?`;
        params.push(startDate, endDate);
        countParams.push(startDate, endDate);
      }
    }

    const limit = parseInt(per_page);
    const offset = (parseInt(page) - 1) * limit;

    // Get total count with all filters applied
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    query += ` ORDER BY p.timestamp ${sort_by_date} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [payments] = await db.query(query, params);
    const paymentIds = payments.map((p) => p.id);

    // Load images
    let images = [];
    if (paymentIds.length > 0) {
      const [imageResults] = await db.query(
        `SELECT *, CONCAT('http://127.0.0.1:8000/storage', path) as src
         FROM images
         WHERE imageable_id IN (?) AND imageable_type = 'App\\Models\\Payment'`,
        [paymentIds]
      );
      images = imageResults;
    }

    // Load paymentable data
    const paymentableData = {};

    // Load purchases
    const purchaseIds = payments
      .filter((p) => p.paymentable_type === "App\\Models\\Purchase")
      .map((p) => p.paymentable_id);

    if (purchaseIds.length > 0) {
      const [purchases] = await db.query(
        `SELECT pu.*, s.name as supplier, pu.company_id
         FROM purchases pu
         LEFT JOIN suppliers s ON pu.supplier_id = s.id
         WHERE pu.id IN (?)`,
        [purchaseIds]
      );
      purchases.forEach((pu) => {
        paymentableData[`purchase_${pu.id}`] = pu;
      });
    }

    // Load sales
    const saleIds = payments
      .filter((p) => p.paymentable_type === "App\\Models\\Sale")
      .map((p) => p.paymentable_id);

    if (saleIds.length > 0) {
      const [sales] = await db.query(
        `SELECT s.*, c.name as customer, s.company_id
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         WHERE s.id IN (?)`,
        [saleIds]
      );
      sales.forEach((s) => {
        paymentableData[`sale_${s.id}`] = s;
      });
    }

    // Combine all data
    const data = payments.map((payment) => {
      const paymentWithRelations = { ...payment };

      paymentWithRelations.images = images.filter(
        (img) => img.imageable_id === payment.id
      );

      if (payment.paymentable_type === "App\\Models\\Purchase") {
        paymentWithRelations.paymentable =
          paymentableData[`purchase_${payment.paymentable_id}`] || null;
        paymentWithRelations.supplier =
          paymentWithRelations.paymentable?.supplier || null;
      } else if (payment.paymentable_type === "App\\Models\\Sale") {
        paymentWithRelations.paymentable =
          paymentableData[`sale_${payment.paymentable_id}`] || null;
        paymentWithRelations.supplier = null;
      } else {
        paymentWithRelations.paymentable = null;
        paymentWithRelations.supplier = null;
      }

      return paymentWithRelations;
    });

    const lastPage = Math.ceil(total / limit);
    const path = `${req.protocol}://${req.get("host")}${req.baseUrl}${
      req.path
    }`;

    const response = {
      status: "Success",
      data: {
        current_page: parseInt(page),
        data: data,
        first_page_url: `${path}?page=1`,
        from: offset + 1,
        last_page: lastPage,
        last_page_url: `${path}?page=${lastPage}`,
        links: [
          {
            url: page > 1 ? `${path}?page=${parseInt(page) - 1}` : null,
            label: "&laquo; Anterior",
            active: false,
          },
          {
            url: `${path}?page=${page}`,
            label: page.toString(),
            active: true,
          },
          {
            url: page < lastPage ? `${path}?page=${parseInt(page) + 1}` : null,
            label: "Siguiente &raquo;",
            active: false,
          },
        ],
        next_page_url:
          page < lastPage ? `${path}?page=${parseInt(page) + 1}` : null,
        path: path,
        per_page: limit,
        prev_page_url: page > 1 ? `${path}?page=${parseInt(page) - 1}` : null,
        to: Math.min(offset + limit, total),
        total: total,
      },
      message: null,
    };

    return response;
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Internal server error",
    };
  }
};

exports.create = async (req) => {
  try {
    const {
      date,
      reference_no,
      type,
      paymentable_id,
      amount = 0,
      note = "",
    } = req.body;

    if (!date || !reference_no || !type || !paymentable_id) {
      throw new Error(
        "Missing required fields: date, reference_no, type, or paymentable_id"
      );
    }

    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");
    const paymentableType =
      type === "purchase" ? "App\\Models\\Purchase" : "App\\Models\\Sale";

    // Check duplicate reference_no for same paymentable
    const [existing] = await db.query(
      `SELECT id FROM payments WHERE reference_no = ? AND paymentable_id = ? AND paymentable_type = ?`,
      [reference_no, paymentable_id, paymentableType]
    );

    if (existing.length > 0) {
      throw Error("Reference number already taken");
    }

    const paymentableQuery =
      type === "purchase"
        ? `SELECT s.company, c.name as company_name FROM purchases p
           LEFT JOIN suppliers s ON p.supplier_id = s.id
           LEFT JOIN companies c ON p.company_id = c.id
           WHERE p.id = ?`
        : `SELECT c.company, co.name as company_name FROM sales s
           LEFT JOIN customers c ON s.customer_id = c.id
           LEFT JOIN companies co ON s.company_id = co.id
           WHERE s.id = ?`;

    const [rows] = await db.query(paymentableQuery, [paymentable_id]);

    if (rows.length === 0) {
      throw Error("Paymentable entity not found");
    }

    const paymentableCompany = slugify(rows[0].company || "", { lower: true });
    const companyName = rows[0].company_name || "UnknownCompany";

    const userRole = req.user?.role || "user";

    // Insert payment
    const [paymentResult] = await db.query(
      `INSERT INTO payments (timestamp, reference_no, amount, paymentable_id, paymentable_type, note, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        timestamp,
        reference_no,
        amount,
        paymentable_id,
        paymentableType,
        note,
        userRole !== "secretary" ? 1 : 0,
      ]
    );

    const paymentId = paymentResult.insertId;

    // Upload attachments if any
    if (req.files && req.files.attachment) {
      const attachments = Array.isArray(req.files.attachment)
        ? req.files.attachment
        : [req.files.attachment];

      for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        const ext = path.extname(file.name);

        const attachName = `images/payments/${companyName}_${reference_no}_${paymentable_id}_${paymentableCompany}_${v4()}${ext}`;

        const { key } = await putObject(file.data, attachName);

        await db.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [`${key}`, paymentId, "App\\Models\\Payment"]
        );
      }
    }

    return {
      status: "success",
      payment_id: paymentId,
    };
  } catch (error) {
    console.error(error);
  }
};
