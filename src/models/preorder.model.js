const db = require("../config/db");

exports.searchPurchaseOrders = async (req) => {
  try {
    const values = [];
    const filterConditions = [];

    if (req.query.company_id) {
      filterConditions.push("po.company_id = ?");
      values.push(req.query.company_id);
    }

    if (req.query.reference_no) {
      filterConditions.push("po.reference_no LIKE ?");
      values.push(`%${req.query.reference_no}%`);
    }

    if (req.query.supplier_id) {
      filterConditions.push("po.supplier_id = ?");
      values.push(req.query.supplier_id);
    }

    if (req.query.startDate && req.query.endDate) {
      if (req.query.startDate === req.query.endDate) {
        filterConditions.push("DATE(po.timestamp) = ?");
        values.push(req.query.startDate);
      } else {
        filterConditions.push("DATE(po.timestamp) BETWEEN ? AND ?");
        values.push(req.query.startDate, req.query.endDate);
      }
    }

    if (req.query.expiryStartDate && req.query.expiryEndDate) {
      if (req.query.expiryStartDate === req.query.expiryEndDate) {
        filterConditions.push("DATE(po.expiry_date) = ?");
        values.push(req.query.expiryStartDate);
      } else {
        filterConditions.push("DATE(po.expiry_date) BETWEEN ? AND ?");
        values.push(req.query.expiryStartDate, req.query.expiryEndDate);
      }
    }

    if (req.query.keyword) {
      filterConditions.push(
        "(po.reference_no LIKE ? OR po.timestamp LIKE ? OR po.total_amount LIKE ?)"
      );
      values.push(
        `%${req.query.keyword}%`,
        `%${req.query.keyword}%`,
        `%${req.query.keyword}%`
      );
      filterConditions.push(
        "EXISTS (SELECT 1 FROM companies c WHERE c.id = po.company_id AND c.name LIKE ?)"
      );
      values.push(`%${req.query.keyword}%`);

      filterConditions.push(
        "EXISTS (SELECT 1 FROM suppliers s WHERE s.id = po.supplier_id AND (s.company LIKE ? OR s.name LIKE ?))"
      );
      values.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`);
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const perPage = parseInt(req.query.per_page) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    // Count total purchase orders
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM pre_orders po
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    // Get paginated purchase orders with supplier and company details
    const orderQuery = `
      SELECT po.*, s.name AS supplier_name, s.email AS supplier_email, s.company AS supplier_company, c.name AS company_name
      FROM pre_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN companies c ON c.id = po.company_id
      ${whereClause}
      ORDER BY po.timestamp DESC
      LIMIT ? OFFSET ?
    `;
    const orderValues = [...values, perPage, offset];
    const [purchaseOrderRows] = await db.query(orderQuery, orderValues);

    const purchaseOrderIds = purchaseOrderRows.map((po) => po.id);

    // Get purchase orders for each pre_order_id (pre_order_items) with categories
    const orderItemsQuery = `
      SELECT poi.*, poi.pre_order_id, cat.id AS category_id, cat.name AS category_name
      FROM pre_order_items poi
      LEFT JOIN categories cat ON cat.id = poi.category_id
      WHERE poi.pre_order_id IN (?)
    `;
    const [orderItems] = await db.query(orderItemsQuery, [purchaseOrderIds]);

    // Group the order items by pre_order_id
    const orderItemsMap = orderItems.reduce((map, item) => {
      if (!map[item.pre_order_id]) {
        map[item.pre_order_id] = [];
      }
      map[item.pre_order_id].push(item);
      return map;
    }, {});

    // Get related purchases for each order (to calculate received_amount)
    const purchaseQuery = `
      SELECT purchase_order_id, SUM(total_amount) AS received_amount
      FROM purchase_orders
      WHERE purchase_order_id IN (?)
      GROUP BY purchase_order_id
    `;
    const [purchaseData] = await db.query(purchaseQuery, [purchaseOrderIds]);

    const purchaseMap = purchaseData.reduce((map, data) => {
      map[data.purchase_order_id] = data.received_amount;
      return map;
    }, {});

    // Enrich the pre_orders with supplier, company, received_amount, and orders (order items with categories)
    const enrichedPurchaseOrders = purchaseOrderRows.map((po) => ({
      ...po,
      supplier: {
        id: po.supplier_id,
        name: po.supplier_name,
        email: po.supplier_email,
        company_id: po.company_id,
        company_name: po.supplier_company,
        company: {
          id: po.company_id,
          name: po.company_name,
        },
      },
      received_amount: purchaseMap[po.id] || "0",
      orders: (orderItemsMap[po.id] || []).map((item) => ({
        ...item,
        category: {
          id: item.category_id,
          name: item.category_name,
        },
      })), // Add category information to each order item
    }));

    // Pagination links
    const totalPages = Math.ceil(total / perPage);
    const baseUrl =
      req.query.base_url || "http://your-domain.com/api/purchase_order/search";
    const links = [];

    if (page > 1) {
      links.push({
        url: `${baseUrl}?page=${page - 1}&per_page=${perPage}`,
        label: "&laquo; Previous",
        active: false,
      });
    }

    for (let i = 1; i <= totalPages; i++) {
      links.push({
        url: `${baseUrl}?page=${i}&per_page=${perPage}`,
        label: i.toString(),
        active: i === page,
      });
    }

    if (page < totalPages) {
      links.push({
        url: `${baseUrl}?page=${page + 1}&per_page=${perPage}`,
        label: "Next &raquo;",
        active: false,
      });
    }

    return {
      status: "Success",
      data: {
        current_page: page,
        data: enrichedPurchaseOrders,
        first_page_url: `${baseUrl}?page=1&per_page=${perPage}`,
        from: offset + 1,
        last_page: totalPages,
        last_page_url: `${baseUrl}?page=${totalPages}&per_page=${perPage}`,
        links,
        next_page_url:
          page < totalPages
            ? `${baseUrl}?page=${page + 1}&per_page=${perPage}`
            : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url:
          page > 1 ? `${baseUrl}?page=${page - 1}&per_page=${perPage}` : null,
        to: Math.min(offset + perPage, total),
        total,
      },
      message: null,
    };
  } catch (error) {
    console.log(error);

    return {
      status: "Error",
      message: "Failed to fetch purchase orders",
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
