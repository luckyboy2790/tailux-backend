const db = require("../config/db");

exports.findAll = async () => {
  try {
    const [rows] = await db.query("SELECT * FROM suppliers");
    return {
      status: "Success",
      data: rows,
      message: null,
    };
  } catch (error) {
    console.log(error);
    return {
      status: "Failed",
      data: [],
      message: error,
    };
  }
};

exports.searchSuppliers = async (req) => {
  try {
    const values = [];
    const filterConditions = [];

    // Keyword search
    if (req.query.keyword) {
      filterConditions.push(`(
        name LIKE ?
        OR company LIKE ?
        OR email LIKE ?
        OR phone_number LIKE ?
        OR address LIKE ?
        OR city LIKE ?
      )`);
      const keywordLike = `%${req.query.keyword}%`;
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

    // Pagination
    const perPage = parseInt(req.query.per_page) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM suppliers ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    // Main query
    const supplierQuery = `
      SELECT * FROM suppliers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const supplierValues = [...values, perPage, offset];
    const [supplierRows] = await db.query(supplierQuery, supplierValues);
    const supplierIds = supplierRows.map((r) => r.id);

    if (!supplierIds.length) {
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

    // Get purchase stats for each supplier
    const [purchaseStats] = await db.query(
      `
      SELECT
        supplier_id,
        COUNT(*) AS total_purchases,
        SUM(CASE WHEN status = 1 THEN grand_total ELSE 0 END) AS total_amount
      FROM purchases
      WHERE supplier_id IN (${supplierIds.map(() => "?").join(",")})
      GROUP BY supplier_id
    `,
      supplierIds
    );

    // Get payment stats for each supplier
    const [paymentStats] = await db.query(
      `
      SELECT
        p.supplier_id,
        SUM(py.amount) AS paid_amount
      FROM purchases p
      JOIN payments py ON py.paymentable_id = p.id AND py.paymentable_type = 'App\\\\Models\\\\Purchase'
      WHERE p.supplier_id IN (${supplierIds.map(() => "?").join(",")})
        AND p.status = 1
      GROUP BY p.supplier_id
    `,
      supplierIds
    );

    // Get return stats for each supplier
    const [returnStats] = await db.query(
      `
      SELECT
        p.supplier_id,
        SUM(pr.amount) AS returned_amount
      FROM purchases p
      JOIN preturns pr ON pr.purchase_id = p.id
      WHERE p.supplier_id IN (${supplierIds.map(() => "?").join(",")})
        AND p.status = 1
        AND pr.status = 1
      GROUP BY p.supplier_id
    `,
      supplierIds
    );

    // Create maps for quick lookup
    const purchaseMap = {};
    purchaseStats.forEach((stat) => {
      purchaseMap[stat.supplier_id] = {
        total_purchases: stat.total_purchases,
        total_amount: stat.total_amount || 0,
      };
    });

    const paymentMap = {};
    paymentStats.forEach((stat) => {
      paymentMap[stat.supplier_id] = {
        paid_amount: stat.paid_amount || 0,
      };
    });

    const returnMap = {};
    returnStats.forEach((stat) => {
      returnMap[stat.supplier_id] = {
        returned_amount: stat.returned_amount || 0,
      };
    });

    // Enrich supplier data with stats
    const enriched = supplierRows.map((supplier) => {
      const purchaseData = purchaseMap[supplier.id] || {
        total_purchases: 0,
        total_amount: 0,
      };
      const paymentData = paymentMap[supplier.id] || { paid_amount: 0 };
      const returnData = returnMap[supplier.id] || { returned_amount: 0 };

      // Calculate final total amount (subtracting returns)
      const finalTotalAmount =
        purchaseData.total_amount - returnData.returned_amount;

      return {
        ...supplier,
        total_purchases: purchaseData.total_purchases,
        total_amount: finalTotalAmount,
        paid_amount: paymentData.paid_amount,
        created_at: supplier.created_at.toISOString(),
        updated_at: supplier.updated_at.toISOString(),
      };
    });

    // Generate pagination links
    const totalPages = Math.ceil(total / perPage);
    const baseUrl = `${process.env.APP_URL}/api/supplier/search`;

    const links = [];
    links.push({
      url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
      label: "&laquo; Anterior",
      active: false,
    });

    // Add page links (simplified version - you may want to implement more complex pagination)
    for (let i = 1; i <= Math.min(10, totalPages); i++) {
      links.push({
        url: `${baseUrl}?page=${i}`,
        label: i.toString(),
        active: i === page,
      });
    }

    if (totalPages > 10) {
      links.push({
        url: null,
        label: "...",
        active: false,
      });
      links.push({
        url: `${baseUrl}?page=${totalPages - 1}`,
        label: (totalPages - 1).toString(),
        active: false,
      });
      links.push({
        url: `${baseUrl}?page=${totalPages}`,
        label: totalPages.toString(),
        active: false,
      });
    }

    links.push({
      url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
      label: "Siguiente &raquo;",
      active: false,
    });

    return {
      status: "Success",
      data: {
        current_page: page,
        data: enriched,
        first_page_url: `${baseUrl}?page=1`,
        from: (page - 1) * perPage + 1,
        last_page: totalPages,
        last_page_url: `${baseUrl}?page=${totalPages}`,
        links: links,
        next_page_url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        to: Math.min(page * perPage, total),
        total: total,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch suppliers",
      data: null,
    };
  }
};

exports.getPurchases = async (req) => {
  try {
    const { supplier_id } = req.query;
    const authUser = req.user;

    if (!authUser) {
      return {
        status: "Error",
        message: "Unauthorized",
        data: null,
      };
    }

    const [supplierRows] = await db.query(
      `SELECT * FROM suppliers WHERE id = ?`,
      [supplier_id]
    );

    if (supplierRows.length === 0) {
      return {
        status: "Error",
        message: "Supplier not found",
        data: null,
      };
    }

    const supplier = supplierRows[0];

    // Statistics
    const [purchaseCount] = await db.query(
      `SELECT COUNT(*) as total_purchases FROM purchases WHERE supplier_id = ? AND status = 1`,
      [supplier_id]
    );

    const [totalAmount] = await db.query(
      `SELECT SUM(grand_total) as total_amount FROM purchases WHERE supplier_id = ? AND status = 1`,
      [supplier_id]
    );

    const [paidAmount] = await db.query(
      `SELECT SUM(amount) as paid_amount FROM payments WHERE paymentable_type = 'App\\\\Models\\\\Purchase' AND paymentable_id IN (SELECT id FROM purchases WHERE supplier_id = ? AND status = 1)`,
      [supplier_id]
    );

    supplier.total_purchases = purchaseCount[0].total_purchases || 0;
    supplier.total_amount = totalAmount[0].total_amount || 0;
    supplier.paid_amount = paidAmount[0].paid_amount || 0;

    // Filters
    const filterConditions = ["p.status = 1", "p.supplier_id = ?"];
    const values = [supplier_id];

    if (authUser.company_id) {
      filterConditions.push("p.company_id = ?");
      values.push(authUser.company_id);
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const purchaseQuery = `
      SELECT p.*, SUM(py.amount) as paid_amount,
        p.grand_total as total_amount,
        0 as returned_amount,
        c.id as company_id, c.name as company_name,
        s.id as store_id, s.name as store_name
      FROM purchases p
      LEFT JOIN payments py ON py.paymentable_id = p.id AND py.paymentable_type = 'App\\\\Models\\\\Purchase'
      LEFT JOIN companies c ON c.id = p.company_id
      LEFT JOIN stores s ON s.id = p.store_id
      ${whereClause}
      GROUP BY p.id
      HAVING total_amount > IFNULL(paid_amount, 0)
      ORDER BY p.timestamp DESC
    `;

    const [purchases] = await db.query(purchaseQuery, values);

    if (purchases.length === 0) {
      return {
        status: "Success",
        data: {
          data: [],
          supplier,
        },
        message: null,
      };
    }

    const purchaseIds = purchases.map((p) => p.id);

    const [orders] = await db.query(
      `SELECT o.*, pr.id as product_id, pr.name as product_name,
              pr.code as product_code, pr.unit as product_unit,
              pr.cost as product_cost, pr.price as product_price,
              pr.alert_quantity as product_alert_quantity
       FROM orders o
       LEFT JOIN products pr ON pr.id = o.product_id
       WHERE o.orderable_type = 'App\\\\Models\\\\Purchase'
       AND o.orderable_id IN (?)`,
      [purchaseIds]
    );

    const orderMap = {};
    orders.forEach((order) => {
      if (!orderMap[order.orderable_id]) {
        orderMap[order.orderable_id] = [];
      }
      orderMap[order.orderable_id].push({
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
      });
    });

    const formattedPurchases = purchases.map((purchase) => ({
      ...purchase,
      company: {
        id: purchase.company_id,
        name: purchase.company_name,
        created_at: null,
        updated_at: null,
      },
      store: {
        id: purchase.store_id,
        name: purchase.store_name,
        company_id: purchase.company_id,
        created_at: null,
        updated_at: null,
        company: {
          id: purchase.company_id,
          name: purchase.company_name,
          created_at: null,
          updated_at: null,
        },
      },
      orders: orderMap[purchase.id] || [],
      paid_amount: purchase.paid_amount || 0,
      returned_amount: purchase.returned_amount || 0,
    }));

    return {
      status: "Success",
      data: {
        data: formattedPurchases,
        supplier,
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

exports.create = async (req) => {
  try {
    const {
      name,
      company,
      email,
      phone_number,
      address,
      city,
      note = "",
    } = req.body;

    if (!name || typeof name !== "string") {
      throw new Error("The 'name' field is required and must be a string.");
    }

    if (!company) {
      throw new Error("The 'company' field is required.");
    }

    const [result] = await db.query(
      `INSERT INTO suppliers (name, company, email, phone_number, address, city, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        name,
        company,
        email || null,
        phone_number || null,
        address || null,
        city || null,
        note || null,
      ]
    );

    const [supplier] = await db.query("SELECT * FROM suppliers WHERE id = ?", [
      result.insertId,
    ]);

    return {
      status: "success",
      data: supplier[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to create supplier");
  }
};

exports.update = async (req) => {
  try {
    const { id, name, company, email, phone_number, address, city, note } =
      req.body;

    if (!id || !name || !company) {
      throw new Error("The 'id', 'name', and 'company' fields are required.");
    }

    const [supplier] = await db.query("SELECT * FROM suppliers WHERE id = ?", [
      id,
    ]);
    if (supplier.length === 0) {
      throw new Error("Supplier not found.");
    }

    await db.query(
      `UPDATE suppliers
       SET name = ?, company = ?, email = ?, phone_number = ?, address = ?, city = ?, note = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        name,
        company,
        email || null,
        phone_number || null,
        address || null,
        city || null,
        note || null,
        id,
      ]
    );

    const [updated] = await db.query("SELECT * FROM suppliers WHERE id = ?", [
      id,
    ]);

    return {
      status: "success",
      data: updated[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to update supplier");
  }
};

exports.delete = async (req) => {
  try {
    const { id } = req.params;

    const [supplier] = await db.query("SELECT * FROM suppliers WHERE id = ?", [
      id,
    ]);
    if (supplier.length === 0) {
      throw new Error("Supplier not found.");
    }

    const [purchases] = await db.query(
      "SELECT id FROM purchases WHERE supplier_id = ?",
      [id]
    );
    if (purchases.length > 0) {
      return {
        status: "error",
        message: "Supplier has associated purchases and cannot be deleted.",
        data: null,
      };
    }

    await db.query("DELETE FROM suppliers WHERE id = ?", [id]);

    return {
      status: "success",
      data: null,
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to delete supplier");
  }
};
