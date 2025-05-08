const db = require("../config/db");

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
