const moment = require("moment");
const db = require("../config/db");
const { putObject } = require("../utils/putObject");
const slugify = require("slugify");
const { v4 } = require("uuid");
const path = require("path");

exports.searchPending = async (req) => {
  try {
    if (!req.user || !req.user.id) {
      throw new Error("Unauthorized: User not authenticated");
    }

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

    let userCompanyId = "";
    if (req.user.role === "user" || req.user.role === "secretary") {
      userCompanyId = req.user.company_id;
    }

    const effectiveCompanyId = company_id || userCompanyId;

    if (effectiveCompanyId) {
      const [companyPurchases] = await db.query(
        `SELECT id FROM purchases WHERE company_id = ?`,
        [effectiveCompanyId]
      );

      const [companySales] = await db.query(
        `SELECT id FROM sales WHERE company_id = ?`,
        [effectiveCompanyId]
      );

      const purchaseIds = companyPurchases.map((p) => p.id);
      const saleIds = companySales.map((s) => s.id);

      if (purchaseIds.length === 0 && saleIds.length === 0) {
        return {
          status: "Success",
          data: {
            current_page: parseInt(page),
            data: [],
            first_page_url: "",
            from: 0,
            last_page: 0,
            last_page_url: "",
            links: [],
            next_page_url: null,
            path: "",
            per_page: parseInt(per_page),
            prev_page_url: null,
            to: 0,
            total: 0,
          },
          message: null,
        };
      }

      let purchasePaymentIds = [];
      let salePaymentIds = [];

      if (purchaseIds.length > 0) {
        const [purchasePayments] = await db.query(
          `SELECT id FROM payments 
           WHERE paymentable_type = 'App\\\\Models\\\\Purchase' 
           AND paymentable_id IN (${purchaseIds.map(() => "?").join(",")})`,
          purchaseIds
        );
        purchasePaymentIds = purchasePayments.map((p) => p.id);
      }

      if (saleIds.length > 0) {
        const [salePayments] = await db.query(
          `SELECT id FROM payments 
           WHERE paymentable_type = 'App\\\\Models\\\\Sale' 
           AND paymentable_id IN (${saleIds.map(() => "?").join(",")})`,
          saleIds
        );
        salePaymentIds = salePayments.map((p) => p.id);
      }

      const companyPaymentIds = [...purchasePaymentIds, ...salePaymentIds];

      if (companyPaymentIds.length > 0) {
        query += ` AND p.id IN (${companyPaymentIds.map(() => "?").join(",")})`;
        countQuery += ` AND p.id IN (${companyPaymentIds
          .map(() => "?")
          .join(",")})`;

        params.push(...companyPaymentIds);
        countParams.push(...companyPaymentIds);
      } else {
        return {
          status: "Success",
          data: {
            current_page: parseInt(page),
            data: [],
            first_page_url: "",
            from: 0,
            last_page: 0,
            last_page_url: "",
            links: [],
            next_page_url: null,
            path: "",
            per_page: parseInt(per_page),
            prev_page_url: null,
            to: 0,
            total: 0,
          },
          message: null,
        };
      }
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

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    query += ` ORDER BY p.timestamp ${sort_by_date} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [payments] = await db.query(query, params);
    const paymentIds = payments.map((p) => p.id);

    let images = [];
    if (paymentIds.length > 0) {
      const [imageResults] = await db.query(
        `SELECT *, CONCAT('http://127.0.0.1:8000/storage', path) as src
         FROM images
         WHERE imageable_id IN (?) AND imageable_type = 'App\\\\Models\\\\Payment'`,
        [paymentIds]
      );
      images = imageResults;
    }

    const paymentableData = {};

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
        paymentWithRelations.supplier =
          paymentWithRelations.paymentable?.customer || null;
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

    if (error.message.includes("Unauthorized")) {
      return {
        status: "Error",
        message: error.message,
        code: 401,
      };
    }

    return {
      status: "Error",
      message: "Internal server error",
      code: 500,
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

    if (req.files && req.files.attachment) {
      const attachments = Array.isArray(req.files.attachment)
        ? req.files.attachment
        : [req.files.attachment];

      for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        const ext = path.extname(file.name);

        const attachName = `payments/${companyName}_${reference_no}_${paymentable_id}_${paymentableCompany}_${v4()}${ext}`;

        const { key } = await putObject(file.data, attachName);

        await db.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [`/${key}`, paymentId, "App\\Models\\Payment"]
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

exports.update = async (req) => {
  try {
    const {
      id,
      date,
      reference_no,
      amount = 0,
      note = "",
      paymentable_id,
    } = req.body;

    if (!id || !date) {
      throw new Error("Missing required fields: id or date");
    }

    const [paymentRows] = await db.query(
      "SELECT * FROM payments WHERE id = ?",
      [id]
    );
    if (paymentRows.length === 0) {
      throw new Error("Payment not found");
    }

    const payment = paymentRows[0];
    const paymentableType = payment.paymentable_type;

    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");

    await db.query(
      `UPDATE payments SET timestamp = ?, reference_no = ?, amount = ?, note = ?, updated_at = NOW() WHERE id = ?`,
      [timestamp, reference_no, amount, note, id]
    );

    const paymentableQuery =
      paymentableType === "App\\Models\\Purchase"
        ? `SELECT s.company, c.name as company_name, p.reference_no FROM purchases p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN companies c ON p.company_id = c.id
            WHERE p.id = ?`
        : `SELECT c.company, co.name as company_name, s.reference_no FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN companies co ON s.company_id = co.id
            WHERE s.id = ?`;

    const [rows] = await db.query(paymentableQuery, [paymentable_id]);
    if (rows.length === 0) {
      throw new Error("Paymentable entity not found");
    }

    const companySlug = slugify(rows[0].company || "", { lower: true });
    const companyName = rows[0].company_name || "UnknownCompany";
    const paymentableRef = rows[0].reference_no || "NoRef";

    if (req.files && req.files.attachment) {
      await db.query(
        `DELETE FROM images WHERE imageable_id = ? AND imageable_type = ?`,
        [id, "App\\Models\\Payment"]
      );

      const attachments = Array.isArray(req.files.attachment)
        ? req.files.attachment
        : [req.files.attachment];

      for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        const ext = path.extname(file.name);
        const uniqueName = `${companyName}_${reference_no}_${paymentableRef}_${companySlug}_${v4()}${ext}`;
        const uploadPath = `payments/${uniqueName}`;

        const { key } = await putObject(file.data, uploadPath);

        await db.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
          [`/${key}`, id, "App\\Models\\Payment"]
        );
      }
    }

    return {
      status: "success",
      payment_id: id,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message,
    };
  }
};

exports.delete = async (req) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!id) {
      throw new Error("Missing payment ID");
    }

    const [[payment]] = await db.query("SELECT * FROM payments WHERE id = ?", [
      id,
    ]);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status === 0 && userRole === "admin") {
      const [[paymentable]] = await db.query(
        `SELECT * FROM ${
          payment.paymentable_type === "App\\Models\\Purchase"
            ? "purchases"
            : "sales"
        } WHERE id = ?`,
        [payment.paymentable_id]
      );

      if (!paymentable) {
        throw new Error("Associated record not found");
      }

      let supplier = "";

      if (payment.paymentable_type === "App\\Models\\Purchase") {
        const [[supplierRow]] = await db.query(
          "SELECT company FROM suppliers WHERE id = ?",
          [paymentable.supplier_id]
        );
        supplier = supplierRow?.company || "";
      } else if (payment.paymentable_type === "App\\Models\\Sale") {
        const [[customerRow]] = await db.query(
          "SELECT company FROM customers WHERE id = ?",
          [paymentable.customer_id]
        );
        supplier = customerRow?.company || "";
      }

      await db.query(
        `INSERT INTO notifications
        (company_id, reference_no, supplier, amount, message, notifiable_id, notifiable_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          paymentable.company_id,
          payment.reference_no,
          supplier,
          payment.amount,
          "payment_rejected",
          payment.id,
          payment.paymentable_type,
        ]
      );
    }

    await db.query("DELETE FROM payments WHERE id = ?", [id]);

    return { status: "success" };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message,
    };
  }
};

exports.search = async (req) => {
  try {
    const { type, paymentable_id } = req.query;

    if (!type || !paymentable_id) {
      throw new Error(
        "Missing required query parameters: type or paymentable_id"
      );
    }

    const paymentableType =
      type === "purchase"
        ? "App\\Models\\Purchase"
        : type === "sale"
        ? "App\\Models\\Sale"
        : null;

    if (!paymentableType) {
      throw new Error("Invalid type: must be either 'purchase' or 'sale'");
    }

    const [payments] = await db.query(
      `SELECT * FROM payments WHERE paymentable_id = ? AND paymentable_type = ?`,
      [paymentable_id, paymentableType]
    );

    if (payments.length === 0) {
      return { status: "success", data: [] };
    }

    const paymentIds = payments.map((p) => p.id);
    const placeholders = paymentIds.map(() => "?").join(", ");

    const [images] = await db.query(
      `SELECT * FROM images WHERE imageable_type = 'App\\\\Models\\\\Payment' AND imageable_id IN (${placeholders})`,
      paymentIds
    );

    const paymentsWithImages = payments.map((payment) => {
      const relatedImages = images.filter(
        (img) => img.imageable_id === payment.id
      );
      return {
        ...payment,
        images: relatedImages,
      };
    });

    return {
      status: "success",
      data: paymentsWithImages,
    };
  } catch (error) {
    console.error("[payment.search] error:", error);
    return {
      status: "error",
      message: error.message || "Failed to retrieve payments",
    };
  }
};

exports.approve = async (req) => {
  try {
    const paymentId = req.params.id;

    const [paymentRows] = await db.query(
      `SELECT * FROM payments WHERE id = ?`,
      [paymentId]
    );

    if (!paymentRows.length) throw Error("Payment not found");

    const payment = paymentRows[0];

    await db.query(`UPDATE payments SET status = 1 WHERE id = ?`, [paymentId]);

    const isPurchase = payment.paymentable_type === "App\\Models\\Purchase";
    const isSale = payment.paymentable_type === "App\\Models\\Sale";

    let supplierCompany = "";
    let companyId = null;

    if (isPurchase) {
      const [rows] = await db.query(
        `SELECT s.company, p.company_id
         FROM purchases p
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         WHERE p.id = ?`,
        [payment.paymentable_id]
      );
      if (rows.length > 0) {
        supplierCompany = rows[0].company || "";
        companyId = rows[0].company_id;
      }
    } else if (isSale) {
      const [rows] = await db.query(
        `SELECT c.company, s.company_id
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         WHERE s.id = ?`,
        [payment.paymentable_id]
      );
      if (rows.length > 0) {
        supplierCompany = rows[0].company || "";
        companyId = rows[0].company_id;
      }
    }

    await db.query(
      `INSERT INTO notifications (
         company_id, reference_no, message,
        supplier, amount, notifiable_id, notifiable_type,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        companyId,
        payment.reference_no,
        "payment_approved",
        supplierCompany,
        payment.amount,
        paymentId,
        "App\\Models\\Payment",
      ]
    );

    return {
      status: "success",
      message: "Payment approved",
      data: {
        id: paymentId,
        reference_no: payment.reference_no,
        amount: payment.amount,
        status: 1,
      },
    };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message || "Failed to approve payment",
    };
  }
};

exports.concurrentPaymentCreate = async (req) => {
  try {
    const { date, reference_no, note = "", purchases = "[]" } = req.body;

    const role = req.user?.role;

    if (!date || !reference_no || !purchases) {
      throw new Error(
        "Missing required fields: date, reference_no, or purchases"
      );
    }

    const parsedPurchases = JSON.parse(purchases);
    if (!Array.isArray(parsedPurchases) || parsedPurchases.length === 0) {
      throw new Error("No valid purchases found");
    }

    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");

    const paymentIds = [];

    for (const purchase of parsedPurchases) {
      const paymentable_id = purchase.id;
      const amount = purchase.amount;
      const type = "purchase";

      const paymentableType =
        type === "purchase" ? "App\\Models\\Purchase" : "App\\Models\\Sale";

      const [existing] = await db.query(
        `SELECT id FROM payments WHERE reference_no = ? AND paymentable_id = ? AND paymentable_type = ?`,
        [reference_no, paymentable_id, paymentableType]
      );

      if (existing.length > 0) {
        continue;
      }

      const paymentableQuery = `SELECT s.company, c.name as company_name FROM purchases p
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         LEFT JOIN companies c ON p.company_id = c.id
         WHERE p.id = ?`;

      const [rows] = await db.query(paymentableQuery, [paymentable_id]);

      if (rows.length === 0) {
        continue;
      }

      const paymentableCompany = slugify(rows[0].company || "", {
        lower: true,
      });
      const companyName = rows[0].company_name || "UnknownCompany";

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
          role === "secretary" ? 0 : 1,
        ]
      );

      const paymentId = paymentResult.insertId;
      paymentIds.push(paymentId);

      if (req.files && req.files.attachment) {
        const attachments = Array.isArray(req.files.attachment)
          ? req.files.attachment
          : [req.files.attachment];

        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          const ext = path.extname(file.name);

          const attachName = `payments/${companyName}_${reference_no}_${paymentable_id}_${paymentableCompany}_${v4()}${ext}`;

          const { key } = await putObject(file.data, attachName);

          await db.query(
            `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
             VALUES (?, ?, ?, NOW(), NOW())`,
            [`/${key}`, paymentId, "App\\Models\\Payment"]
          );
        }
      }
    }

    return {
      status: "success",
      created_count: paymentIds.length,
      payment_ids: paymentIds,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};
