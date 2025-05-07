const db = require("../config/db");

exports.searchPurchases = async (filters) => {
  try {
    const values = [];
    const filterConditions = [];

    // Base condition
    filterConditions.push("p.status = 1");

    if (filters.company_id) {
      filterConditions.push("p.company_id = ?");
      values.push(filters.company_id);
    }

    if (filters.supplier_id) {
      filterConditions.push("p.supplier_id = ?");
      values.push(filters.supplier_id);
    }

    if (filters.keyword) {
      filterConditions.push(`
        (
          p.reference_no LIKE ?
          OR p.grand_total LIKE ?
          OR p.supplier_id IN (
            SELECT id FROM suppliers WHERE company LIKE ?
          )
        )
      `);
      const keywordLike = `%${filters.keyword}%`;
      values.push(keywordLike, keywordLike, keywordLike);
    }

    if (filters.startDate && filters.endDate) {
      if (filters.startDate === filters.endDate) {
        filterConditions.push("DATE(p.timestamp) = ?");
        values.push(filters.startDate);
      } else {
        filterConditions.push("p.timestamp BETWEEN ? AND ?");
        values.push(filters.startDate, filters.endDate);
      }
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN payments pay
        ON pay.paymentable_id = p.id
        AND pay.paymentable_type = 'App\\\\Models\\\\Purchase'
      ${whereClause}
    `;

    // Pagination
    const perPage = parseInt(filters.per_page) || 15;
    const page = parseInt(filters.page) || 1;
    const offset = (page - 1) * perPage;

    // Main query
    const dataQuery = `
      SELECT
        p.*,
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.company AS supplier_company,
        s.email AS supplier_email,
        s.phone_number AS supplier_phone,
        s.address AS supplier_address,
        s.city AS supplier_city,
        s.note AS supplier_note,
        IFNULL(SUM(pay.amount), 0) AS paid_amount
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN payments pay
        ON pay.paymentable_id = p.id
        AND pay.paymentable_type = 'App\\\\Models\\\\Purchase'
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.timestamp ${filters.sort_by_date === "asc" ? "ASC" : "DESC"}
      LIMIT ? OFFSET ?
    `;

    // Add pagination values
    const dataValues = [...values, perPage, offset];

    // Execute queries
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const [rows] = await db.query(dataQuery, dataValues);

    const enriched = rows.map((row) => ({
      ...row,
      total_amount: row.grand_total,
      supplier: {
        id: row.supplier_id,
        name: row.supplier_name,
        company: row.supplier_company,
        email: row.supplier_email,
        phone_number: row.supplier_phone,
        address: row.supplier_address,
        city: row.supplier_city,
        note: row.supplier_note,
      },
    }));

    return {
      status: "Success",
      data: {
        current_page: page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
        data: enriched,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch purchases",
      data: null,
    };
  }
};
