const db = require("../config/db");

exports.searchPreOrders = async (req) => {
  try {
    const authUser = req.user;
    const filters = req.query;

    const values = [];
    const filterConditions = [];

    if (authUser.company_id) {
      filterConditions.push("po.company_id = ?");
      values.push(authUser.company_id);
    }

    if (filters.company_id) {
      filterConditions.push("po.company_id = ?");
      values.push(filters.company_id);
    }

    if (filters.reference_no) {
      filterConditions.push("po.reference_no LIKE ?");
      values.push(`%${filters.reference_no}%`);
    }

    if (filters.supplier_id) {
      filterConditions.push("po.supplier_id = ?");
      values.push(filters.supplier_id);
    }

    if (filters.startDate && filters.endDate) {
      if (filters.startDate === filters.endDate) {
        filterConditions.push("DATE(po.timestamp) = ?");
        values.push(filters.startDate);
      } else {
        filterConditions.push("po.timestamp BETWEEN ? AND ?");
        values.push(filters.startDate, filters.endDate);
      }
    }

    if (filters.expiryStartDate && filters.expiryEndDate) {
      if (filters.expiryStartDate === filters.expiryEndDate) {
        filterConditions.push("DATE(po.expiry_date) = ?");
        values.push(filters.expiryStartDate);
      } else {
        filterConditions.push("po.expiry_date BETWEEN ? AND ?");
        values.push(filters.expiryStartDate, filters.expiryEndDate);
      }
    }

    if (filters.keyword) {
      filterConditions.push(`
        (
          po.reference_no LIKE ?
          OR po.grand_total LIKE ?
          OR po.timestamp LIKE ?
          OR po.company_id IN (SELECT id FROM companies WHERE name LIKE ?)
          OR po.supplier_id IN (SELECT id FROM suppliers WHERE company LIKE ?)
        )
      `);
      const keywordLike = `%${filters.keyword}%`;
      values.push(
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike
      );
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const countQuery = `
      SELECT COUNT(DISTINCT po.id) AS total
      FROM pre_orders po
      ${whereClause}
    `;

    const perPage = parseInt(filters.per_page) || 15;
    const page = parseInt(filters.page) || 1;
    const offset = (page - 1) * perPage;

    const sortOrder = filters.sort_by_date === "asc" ? "ASC" : "DESC";

    const preOrderQuery = `
      SELECT
        po.*,
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.company AS supplier_company,
        s.email AS supplier_email,
        s.phone_number AS supplier_phone,
        s.address AS supplier_address,
        s.city AS supplier_city,
        s.note AS supplier_note,
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
        0 AS returned_amount
      FROM pre_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN companies c ON c.id = po.company_id
      LEFT JOIN users u ON u.id = po.user_id
      LEFT JOIN payments pay
        ON pay.paymentable_id = po.id
        AND pay.paymentable_type = 'App\\\\Models\\\\PreOrder'
      ${whereClause}
      GROUP BY po.id
      ORDER BY po.timestamp ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const preOrderValues = [...values, perPage, offset];

    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const [preOrderRows] = await db.query(preOrderQuery, preOrderValues);

    const enriched = await Promise.all(
      preOrderRows.map(async (row) => {
        const [orders] = await db.query(
          `SELECT
            poi.id,
            poi.product_id,
            poi.cost,
            NULL as price,
            poi.quantity,
            poi.subtotal,
            poi.expiry_date,
            poi.serial_no,
            poi.pre_order_id as orderable_id,
            'App\\\\Models\\\\PreOrder' as orderable_type,
            NULL as pre_order_item_id,
            poi.created_at,
            poi.updated_at,
            p.name AS product_name,
            p.code AS product_code,
            p.unit AS product_unit,
            p.cost AS product_cost,
            p.price AS product_price,
            p.alert_quantity AS product_alert_quantity
           FROM pre_order_items poi
           LEFT JOIN products p ON p.id = poi.product_id
           WHERE poi.pre_order_id = ?`,
          [row.id]
        );

        const [payments] = await db.query(
          `SELECT * FROM payments
           WHERE paymentable_id = ? AND paymentable_type = 'App\\\\Models\\\\PreOrder'`,
          [row.id]
        );

        const [images] = await db.query(
          `SELECT *, CONCAT('http://your-domain.com/storage', path) AS src, 'image' AS type
           FROM images
           WHERE imageable_id = ? AND imageable_type = 'App\\\\Models\\\\PreOrder'`,
          [row.id]
        );

        const preturns = [];

        const [stores] = await db.query(
          `SELECT * FROM stores WHERE company_id = ? LIMIT 1`,
          [row.company_id]
        );
        const store = stores[0] || null;

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
            product: order.product_id
              ? {
                  id: order.product_id,
                  name: order.product_name,
                  code: order.product_code,
                  unit: order.product_unit,
                  cost: order.product_cost,
                  price: order.product_price,
                  alert_quantity: order.product_alert_quantity,
                }
              : null,
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
          store: store
            ? {
                id: store.id,
                name: store.name,
                company: {
                  id: row.company_id,
                  name: row.company_name,
                },
              }
            : null,
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
      message: "Failed to fetch pre-orders",
      data: null,
    };
  }
};

exports.searchReceivedOrders = async (filters) => {
  try {
    const values = [];
    const filterConditions = [];
    // const authUser = filters.auth_user;

    // Base query conditions
    // if (authUser && authUser.company_id) {
    //   filterConditions.push("p.company_id = ?");
    //   values.push(authUser.company_id);
    // }

    filterConditions.push("p.order_id IS NOT NULL");

    if (filters.order_id) {
      filterConditions.push("p.order_id = ?");
      values.push(filters.order_id);
    }

    if (filters.company_id) {
      filterConditions.push("p.company_id = ?");
      values.push(filters.company_id);
    }

    if (filters.reference_no) {
      filterConditions.push("p.reference_no LIKE ?");
      values.push(`%${filters.reference_no}%`);
    }

    if (filters.supplier_id) {
      filterConditions.push("p.supplier_id = ?");
      values.push(filters.supplier_id);
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

    if (filters.keyword) {
      filterConditions.push(`
        (
          p.reference_no LIKE ?
          OR p.grand_total LIKE ?
          OR p.company_id IN (SELECT id FROM companies WHERE name LIKE ?)
          OR p.store_id IN (SELECT id FROM stores WHERE name LIKE ?)
          OR p.supplier_id IN (SELECT id FROM suppliers WHERE company LIKE ?)
          OR p.timestamp LIKE ?
        )
      `);
      const keywordLike = `%${filters.keyword}%`;
      values.push(
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike
      );
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM purchases p
      ${whereClause}
    `;

    const perPage = parseInt(filters.per_page) || 15;
    const page = parseInt(filters.page) || 1;
    const offset = (page - 1) * perPage;

    const sortOrder = filters.sort_by_date === "asc" ? "ASC" : "DESC";

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
        c.id AS company_id,
        c.name AS company_name,
        st.id AS store_id,
        st.name AS store_name,
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
        IFNULL(SUM(pret.amount), 0) AS returned_amount
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN companies c ON c.id = p.company_id
      LEFT JOIN stores st ON st.id = p.store_id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN payments pay
        ON pay.paymentable_id = p.id
        AND pay.paymentable_type = 'App\\\\Models\\\\Purchase'
      LEFT JOIN preturns pret ON pret.purchase_id = p.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.timestamp ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const purchaseValues = [...values, perPage, offset];

    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const [purchaseRows] = await db.query(purchaseQuery, purchaseValues);

    const enriched = await Promise.all(
      purchaseRows.map(async (row) => {
        // Get orders
        const [orders] = await db.query(
          `SELECT
            o.id,
            o.product_id,
            o.cost,
            o.price,
            o.quantity,
            o.subtotal,
            o.expiry_date,
            o.serial_no,
            o.orderable_id,
            o.orderable_type,
            o.pre_order_item_id,
            o.created_at,
            o.updated_at,
            p.name AS product_name,
            p.code AS product_code,
            p.unit AS product_unit,
            p.cost AS product_cost,
            p.price AS product_price,
            p.alert_quantity AS product_alert_quantity
           FROM orders o
           LEFT JOIN products p ON p.id = o.product_id
           WHERE o.orderable_id = ? AND o.orderable_type = 'App\\\\Models\\\\Purchase'`,
          [row.id]
        );

        // Get payments
        const [payments] = await db.query(
          `SELECT * FROM payments
           WHERE paymentable_id = ? AND paymentable_type = 'App\\\\Models\\\\Purchase'`,
          [row.id]
        );

        // Get preturns
        const [preturns] = await db.query(
          `SELECT * FROM preturns WHERE purchase_id = ?`,
          [row.id]
        );

        // Get images
        const [images] = await db.query(
          `SELECT *,
                  CONCAT('http://your-domain.com/storage', path) AS src,
                  'image' AS type
           FROM images
           WHERE imageable_id = ? AND imageable_type = 'App\\\\Models\\\\Purchase'`,
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
            product: order.product_id
              ? {
                  id: order.product_id,
                  name: order.product_name,
                  code: order.product_code,
                  unit: order.product_unit,
                  cost: order.product_cost,
                  price: order.product_price,
                  alert_quantity: order.product_alert_quantity,
                }
              : null,
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
      message: "Failed to fetch received orders",
      data: null,
    };
  }
};
