const db = require("../config/db");

exports.searchPurchases = async (filters) => {
  try {
    const values = [];
    const filterConditions = ["p.status = 1"];

    if (filters.company_id) {
      filterConditions.push("p.company_id = ?");
      values.push(filters.company_id);
    }

    if (filters.supplier_id) {
      filterConditions.push("p.supplier_id = ?");
      values.push(filters.supplier_id);
    }

    if (filters.keyword) {
      filterConditions.push(`(
        p.reference_no LIKE ?
        OR p.grand_total LIKE ?
        OR p.supplier_id IN (SELECT id FROM suppliers WHERE company LIKE ?)
      )`);
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

    const perPage = parseInt(filters.per_page) || 15;
    const page = parseInt(filters.page) || 1;
    const offset = (page - 1) * perPage;

    const countQuery = `SELECT COUNT(*) AS total FROM purchases p ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

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
        u.picture AS user_picture
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN stores st ON st.id = p.store_id
      LEFT JOIN companies c ON c.id = p.company_id
      LEFT JOIN users u ON u.id = p.user_id
      ${whereClause}
      ORDER BY p.timestamp ${filters.sort_by_date === "asc" ? "ASC" : "DESC"}
      LIMIT ? OFFSET ?
    `;

    const purchaseValues = [...values, perPage, offset];
    const [purchaseRows] = await db.query(purchaseQuery, purchaseValues);
    const purchaseIds = purchaseRows.map((r) => r.id);

    if (!purchaseIds.length) {
      return {
        status: "Success",
        data: {
          current_page: page,
          per_page: perPage,
          total,
          total_pages: Math.ceil(total / perPage),
          data: [],
        },
        message: null,
      };
    }

    const [orders] = await db.query(
      `
      SELECT o.*, o.orderable_id AS purchase_id,
             pr.name AS product_name,
             pr.code AS product_code,
             pr.unit AS product_unit,
             pr.cost AS product_cost,
             pr.price AS product_price,
             pr.alert_quantity AS product_alert_quantity
      FROM orders o
      LEFT JOIN products pr ON pr.id = o.product_id
      WHERE o.orderable_type = 'App\\\\Models\\\\Purchase'
        AND o.orderable_id IN (${purchaseIds.map(() => "?").join(",")})
    `,
      purchaseIds
    );

    const [payments] = await db.query(
      `
      SELECT *, paymentable_id AS purchase_id
      FROM payments
      WHERE paymentable_type = 'App\\\\Models\\\\Purchase'
        AND paymentable_id IN (${purchaseIds.map(() => "?").join(",")})
    `,
      purchaseIds
    );

    const [preturns] = await db.query(
      `
      SELECT *, purchase_id
      FROM preturns
      WHERE purchase_id IN (${purchaseIds.map(() => "?").join(",")})
    `,
      purchaseIds
    );

    const [images] = await db.query(
      `
      SELECT *, imageable_id AS purchase_id,
             CONCAT('http://your-domain.com/storage', path) AS src,
             'image' AS type
      FROM images
      WHERE imageable_type = 'App\\\\Models\\\\Purchase'
        AND imageable_id IN (${purchaseIds.map(() => "?").join(",")})
    `,
      purchaseIds
    );

    const mapById = (items, key = "purchase_id") => {
      const map = {};
      for (const item of items) {
        const id = item[key];
        if (!map[id]) map[id] = [];
        map[id].push(item);
      }
      return map;
    };

    const orderMap = mapById(orders);
    const paymentMap = mapById(payments);
    const returnMap = mapById(preturns);
    const imageMap = mapById(images);

    const enriched = purchaseRows.map((row) => {
      const totalPaid = (paymentMap[row.id] || []).reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );
      const totalReturned = (returnMap[row.id] || []).reduce(
        (sum, r) => sum + parseFloat(r.amount),
        0
      );

      return {
        ...row,
        total_amount: row.grand_total - totalReturned,
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
        orders: (orderMap[row.id] || []).map((order) => ({
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
        payments: paymentMap[row.id] || [],
        preturns: returnMap[row.id] || [],
        images: imageMap[row.id] || [],
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
        paid_amount: totalPaid,
        returned_amount: totalReturned,
      };
    });

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

exports.searchPendingPurchases = async (req) => {
  try {
    const {
      company_id = "",
      supplier_id = "",
      keyword = "",
      startDate = "",
      endDate = "",
      expiryStartDate = "",
      expiryEndDate = "",
      sort_by_date = "desc",
      page = 1,
      per_page = 15,
    } = req.query;

    let query = `
      SELECT
        p.*,
        s.name AS supplier_name,
        s.company AS supplier_company,
        s.email AS supplier_email,
        s.phone_number AS supplier_phone,
        s.address AS supplier_address,
        s.city AS supplier_city,
        s.note AS supplier_note,
        st.name AS store_name,
        c.name AS company_name,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.email AS user_email,
        u.phone_number AS user_phone,
        u.role AS user_role,
        u.status AS user_status,
        u.picture AS user_picture,
        COALESCE(SUM(pm.amount), 0) AS paid_amount,
        COALESCE(SUM(ptr.amount), 0) AS returned_amount,
        (p.grand_total - COALESCE(SUM(ptr.amount), 0)) AS total_amount
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN payments pm ON pm.paymentable_id = p.id AND pm.paymentable_type = 'purchase'
      LEFT JOIN preturns ptr ON ptr.purchase_id = p.id
      WHERE p.status = 0
    `;

    const params = [];

    if (company_id) {
      query += ` AND p.company_id = ?`;
      params.push(company_id);
    }

    if (supplier_id) {
      query += ` AND p.supplier_id = ?`;
      params.push(supplier_id);
    }

    if (keyword) {
      query += ` AND (
        p.reference_no LIKE ? OR
        p.timestamp LIKE ? OR
        p.grand_total LIKE ? OR
        c.name LIKE ? OR
        st.name LIKE ? OR
        s.company LIKE ?
      )`;
      const keywordLike = `%${keyword}%`;
      params.push(
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike
      );
    }

    if (startDate && endDate) {
      if (startDate === endDate) {
        query += ` AND DATE(p.timestamp) = ?`;
        params.push(startDate);
      } else {
        query += ` AND p.timestamp BETWEEN ? AND ?`;
        params.push(startDate, endDate);
      }
    }

    if (expiryStartDate && expiryEndDate) {
      if (expiryStartDate === expiryEndDate) {
        query += ` AND DATE(p.expiry_date) = ?`;
        params.push(expiryStartDate);
      } else {
        query += ` AND p.expiry_date BETWEEN ? AND ?`;
        params.push(expiryStartDate, expiryEndDate);
      }
    }

    query += ` GROUP BY p.id`;

    query += ` ORDER BY p.timestamp ${sort_by_date === "asc" ? "ASC" : "DESC"}`;

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) AS total_purchases`;
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / per_page);

    const offset = (page - 1) * per_page;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(per_page), offset);

    const [purchases] = await db.query(query, params);

    for (const purchase of purchases) {
      const [orders] = await db.query(
        `
        SELECT o.*,
          prod.name AS product_name,
          prod.code AS product_code,
          prod.unit AS product_unit,
          prod.cost AS product_cost,
          prod.price AS product_price,
          prod.alert_quantity AS product_alert_quantity
        FROM orders o
        LEFT JOIN products prod ON o.product_id = prod.id
        WHERE o.orderable_id = ? AND o.orderable_type = 'purchase'
      `,
        [purchase.id]
      );

      purchase.orders = orders.map((order) => ({
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
      }));

      const [payments] = await db.query(
        `
        SELECT * FROM payments
        WHERE paymentable_id = ? AND paymentable_type = 'purchase'
      `,
        [purchase.id]
      );
      purchase.payments = payments;

      const [preturns] = await db.query(
        `
        SELECT * FROM preturns
        WHERE purchase_id = ?
      `,
        [purchase.id]
      );
      purchase.preturns = preturns;

      const [images] = await db.query(
        `
        SELECT *,
          CONCAT('http://your-domain.com/storage', path) AS src,
          'image' AS type
        FROM images
        WHERE imageable_id = ? AND imageable_type = 'purchase'
      `,
        [purchase.id]
      );
      purchase.images = images;

      purchase.company = {
        id: purchase.company_id,
        name: purchase.company_name,
      };

      purchase.supplier = {
        id: purchase.supplier_id,
        name: purchase.supplier_name,
        company: purchase.supplier_company,
        email: purchase.supplier_email,
        phone_number: purchase.supplier_phone,
        address: purchase.supplier_address,
        city: purchase.supplier_city,
        note: purchase.supplier_note,
      };

      purchase.store = {
        id: purchase.store_id,
        name: purchase.store_name,
        company: {
          id: purchase.company_id,
          name: purchase.company_name,
        },
      };

      purchase.user = {
        id: purchase.user_id,
        username: purchase.user_username,
        first_name: purchase.user_first_name,
        last_name: purchase.user_last_name,
        email: purchase.user_email,
        phone_number: purchase.user_phone,
        role: purchase.user_role,
        status: purchase.user_status,
        picture: purchase.user_picture,
        name: `${purchase.user_first_name} ${purchase.user_last_name}`,
        company: {
          id: purchase.company_id,
          name: purchase.company_name,
        },
      };
    }

    return {
      status: "Success",
      data: {
        current_page: parseInt(page),
        per_page: parseInt(per_page),
        total: total,
        total_pages: totalPages,
        data: purchases,
      },
      message: null,
    };
  } catch (error) {
    console.error("Error in searchPending:", error);
    throw error;
  }
};

exports.getPurchaseDetail = async (req) => {
  try {
    const { purchaseId } = req.query;

    const [purchaseRows] = await db.query(
      `
      SELECT * FROM purchases WHERE id = ?
    `,
      [purchaseId]
    );

    if (purchaseRows.length === 0) {
      throw new Error("Purchase not found");
    }

    const purchase = purchaseRows[0];

    const [
      [userRows],
      [ordersRows],
      [paymentsRows],
      [preturnsRows],
      [imagesRows],
      [companyRows],
      [supplierRows],
      [storeRows],
    ] = await Promise.all([
      db.query(`SELECT * FROM users WHERE id = ?`, [purchase.user_id]),
      db.query(
        `SELECT * FROM orders WHERE orderable_id = ? AND orderable_type = 'App\\Models\\Purchase'`,
        [purchaseId]
      ),
      db.query(
        `SELECT * FROM payments WHERE paymentable_id = ? AND paymentable_type = 'App\\Models\\Purchase'`,
        [purchaseId]
      ),
      db.query(`SELECT * FROM preturns WHERE purchase_id = ?`, [purchaseId]),
      db.query(
        `SELECT * FROM images WHERE imageable_id = ? AND imageable_type = 'App\\Models\\Purchase'`,
        [purchaseId]
      ),
      db.query(`SELECT * FROM companies WHERE id = ?`, [purchase.company_id]),
      db.query(`SELECT * FROM suppliers WHERE id = ?`, [purchase.supplier_id]),
      db.query(`SELECT * FROM stores WHERE id = ?`, [purchase.store_id]),
    ]);

    const returnedAmount = preturnsRows
      .filter((item) => item.status === 1)
      .reduce((sum, item) => sum + (item.amount || 0), 0);

    const paidAmount = paymentsRows
      .filter((item) => item.status === 1)
      .reduce((sum, item) => sum + (item.amount || 0), 0);

    const totalAmount = (purchase.grand_total || 0) - returnedAmount;

    purchase.user = userRows[0] || null;
    purchase.orders = ordersRows;
    purchase.payments = paymentsRows;
    purchase.preturns = preturnsRows;
    purchase.images = imagesRows;
    purchase.company = companyRows[0] || null;
    purchase.supplier = supplierRows[0] || null;
    purchase.store = storeRows[0] || null;

    purchase.total_amount = totalAmount;
    purchase.paid_amount = paidAmount;
    purchase.returned_amount = returnedAmount;

    return {
      status: "success",
      data: purchase,
    };
  } catch (error) {
    console.error(error);
  }
};
