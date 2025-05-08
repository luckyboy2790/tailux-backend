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

    // Main query to get purchases
    const purchaseQuery = `
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
        st.id AS store_id,
        st.name AS store_name,
        c.id AS company_id,
        c.name AS company_name,
        u.id AS user_id,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.email AS user_email,
        u.phone_number AS user_phone,
        u.role AS user_role,
        u.status AS user_status,
        u.picture AS user_picture,
        IFNULL(SUM(pay.amount), 0) AS paid_amount,
        IFNULL(SUM(ptr.amount), 0) AS returned_amount
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN stores st ON st.id = p.store_id
      LEFT JOIN companies c ON c.id = p.company_id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN payments pay
        ON pay.paymentable_id = p.id
        AND pay.paymentable_type = 'App\\\\Models\\\\Purchase'
      LEFT JOIN preturns ptr
        ON ptr.purchase_id = p.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.timestamp ${filters.sort_by_date === "asc" ? "ASC" : "DESC"}
      LIMIT ? OFFSET ?
    `;

    // Add pagination values
    const purchaseValues = [...values, perPage, offset];

    // Execute queries
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const [purchaseRows] = await db.query(purchaseQuery, purchaseValues);

    // Get additional data for each purchase
    const enriched = await Promise.all(
      purchaseRows.map(async (row) => {
        // Get orders
        const [orders] = await db.query(
          `
        SELECT o.*,
               pr.name AS product_name,
               pr.code AS product_code,
               pr.unit AS product_unit,
               pr.cost AS product_cost,
               pr.price AS product_price,
               pr.alert_quantity AS product_alert_quantity
        FROM orders o
        LEFT JOIN products pr ON pr.id = o.product_id
        WHERE o.orderable_id = ? AND o.orderable_type = 'App\\\\Models\\\\Purchase'
      `,
          [row.id]
        );

        // Get payments
        const [payments] = await db.query(
          `
        SELECT * FROM payments
        WHERE paymentable_id = ? AND paymentable_type = 'App\\\\Models\\\\Purchase'
      `,
          [row.id]
        );

        // Get returns
        const [preturns] = await db.query(
          `
        SELECT * FROM preturns WHERE purchase_id = ?
      `,
          [row.id]
        );

        // Get images
        const [images] = await db.query(
          `
        SELECT *,
               CONCAT('http://your-domain.com/storage', path) AS src,
               'image' AS type
        FROM images
        WHERE imageable_id = ? AND imageable_type = 'App\\\\Models\\\\Purchase'
      `,
          [row.id]
        );

        return {
          ...row,
          total_amount: row.grand_total,
          user: {
            id: row.user_id,
            username: row.user_username,
            first_name: row.user_first_name,
            last_name: row.user_last_name,
            email: row.user_email,
            phone_number: row.user_phone,
            role: row.user_role,
            status: row.user_status,
            picture: row.user_picture,
            name: `${row.user_first_name} ${row.user_last_name}`,
            company: {
              id: row.company_id,
              name: row.company_name,
            },
          },
          orders: orders.map((order) => ({
            ...order,
            product: {
              id: order.product_id,
              name: order.product_name,
              code: order.product_code,
              unit: order.product_unit,
              cost: order.product_cost,
              price: order.product_price,
              alert_quantity: order.product_alert_quantity,
            },
          })),
          payments,
          preturns,
          images,
          company: {
            id: row.company_id,
            name: row.company_name,
          },
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
          store: {
            id: row.store_id,
            name: row.store_name,
            company: {
              id: row.company_id,
              name: row.company_name,
            },
          },
        };
      })
    );

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
