const db = require("../config/db");

exports.findAll = async () => {
  try {
    const [rows] = await db.query("SELECT * FROM customers");
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

exports.searchCustomers = async (req) => {
  try {
    const values = [];
    const filterConditions = [];

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

    const perPage = parseInt(req.query.per_page) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    // Count total records
    const countQuery = `SELECT COUNT(*) AS total FROM customers ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    // Get paginated customer data
    const customerQuery = `
      SELECT * FROM customers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const customerValues = [...values, perPage, offset];
    const [customerRows] = await db.query(customerQuery, customerValues);
    const customerIds = customerRows.map((r) => r.id);

    if (!customerIds.length) {
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

    // Get sales data for each customer
    const [sales] = await db.query(
      `SELECT
        customer_id,
        COUNT(*) AS total_sales_count,
        SUM(grand_total) AS total_amount
       FROM sales
       WHERE status = 1
         AND customer_id IN (${customerIds.map(() => "?").join(",")})
       GROUP BY customer_id`,
      customerIds
    );

    // Get payments data for each customer's sales
    const [payments] = await db.query(
      `SELECT
        s.customer_id,
        SUM(p.amount) AS paid_amount
       FROM payments p
       JOIN sales s ON s.id = p.paymentable_id
       WHERE p.paymentable_type = 'App\\\\Models\\\\Sale'
         AND s.customer_id IN (${customerIds.map(() => "?").join(",")})
       GROUP BY s.customer_id`,
      customerIds
    );

    // Create maps for quick lookup
    const salesMap = {};
    sales.forEach((sale) => {
      salesMap[sale.customer_id] = {
        total_sales: sale.total_sales_count || 0,
        total_amount: parseInt(sale.total_amount) || 0,
      };
    });

    const paymentsMap = {};
    payments.forEach((payment) => {
      paymentsMap[payment.customer_id] = parseInt(payment.paid_amount) || 0;
    });

    // Enrich customer data with sales and payment info
    const enriched = customerRows.map((row) => ({
      ...row,
      total_sales: salesMap[row.id]?.total_sales || 0,
      total_amount: salesMap[row.id]?.total_amount || 0,
      paid_amount: paymentsMap[row.id] || 0,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / perPage);
    const baseUrl = `${process.env.APP_URL}/api/customer/search`;

    return {
      status: "Success",
      data: {
        current_page: page,
        data: enriched,
        first_page_url: `${baseUrl}?page=1`,
        from: offset + 1,
        last_page: totalPages,
        last_page_url: `${baseUrl}?page=${totalPages}`,
        links: [
          {
            url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
            label: "&laquo; Anterior",
            active: false,
          },
          ...Array.from({ length: totalPages }, (_, i) => ({
            url: `${baseUrl}?page=${i + 1}`,
            label: (i + 1).toString(),
            active: i + 1 === page,
          })),
          {
            url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
            label: "Siguiente &raquo;",
            active: false,
          },
        ],
        next_page_url: page < totalPages ? `${baseUrl}?page=${page + 1}` : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        to: Math.min(offset + perPage, total),
        total,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch customers",
      data: null,
    };
  }
};

exports.create = async (req) => {
  try {
    const { name, company, email, phone_number, address, city } = req.body;

    if (!name || typeof name !== "string") {
      throw new Error("The 'name' field is required and must be a string.");
    }

    const [existing] = await db.query(
      "SELECT id FROM customers WHERE name = ? AND phone_number = ?",
      [name, phone_number || null]
    );
    if (existing.length > 0) {
      throw new Error(
        "Customer already exists with the same name and phone number."
      );
    }

    const [result] = await db.query(
      `INSERT INTO customers (name, company, email, phone_number, address, city, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        name,
        company || null,
        email || null,
        phone_number || null,
        address || null,
        city || null,
      ]
    );

    const [customer] = await db.query("SELECT * FROM customers WHERE id = ?", [
      result.insertId,
    ]);

    return {
      status: "success",
      data: customer[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to create customer");
  }
};

exports.update = async (req) => {
  try {
    const { id, name, company, email, phone_number, address, city } = req.body;

    if (!id || !name || typeof name !== "string") {
      throw new Error("The 'id' and 'name' fields are required.");
    }

    const [existing] = await db.query("SELECT * FROM customers WHERE id = ?", [
      id,
    ]);
    if (existing.length === 0) {
      throw new Error("Customer not found.");
    }

    await db.query(
      `UPDATE customers
       SET name = ?, company = ?, email = ?, phone_number = ?, address = ?, city = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        name,
        company || null,
        email || null,
        phone_number || null,
        address || null,
        city || null,
        id,
      ]
    );

    const [updated] = await db.query("SELECT * FROM customers WHERE id = ?", [
      id,
    ]);

    return {
      status: "success",
      data: updated[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to update customer");
  }
};

exports.delete = async (req) => {
  try {
    const { id } = req.params;

    const [customerRows] = await db.query(
      "SELECT * FROM customers WHERE id = ?",
      [id]
    );
    if (customerRows.length === 0) {
      throw new Error("Customer not found.");
    }

    const [sales] = await db.query(
      "SELECT id FROM sales WHERE customer_id = ?",
      [id]
    );
    if (sales.length > 0) {
      return {
        status: "error",
        message: "Customer has associated sales and cannot be deleted.",
        data: null,
      };
    }

    await db.query("DELETE FROM customers WHERE id = ?", [id]);

    return {
      status: "success",
      data: null,
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to delete customer");
  }
};
