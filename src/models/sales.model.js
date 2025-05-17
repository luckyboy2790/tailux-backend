const db = require("../config/db");

exports.searchSales = async (req, res) => {
  try {
    const {
      company_id = "",
      customer_id = "",
      endDate = "",
      keyword = "",
      page = 1,
      per_page = 15,
      sort_by_date = "desc",
      startDate = "",
    } = req.query;

    let query = `
      SELECT
        s.*,
        c.id as customer_id,
        c.name as customer_name,
        c.company as customer_company,
        c.email as customer_email,
        c.phone_number as customer_phone_number,
        c.address as customer_address,
        c.city as customer_city,
        c.created_at as customer_created_at,
        c.updated_at as customer_updated_at,
        u.id as user_id,
        u.username as user_username,
        u.first_name as user_first_name,
        u.last_name as user_last_name,

        u.email as user_email,
        u.phone_number as user_phone_number,
        u.role as user_role,
        u.status as user_status,

        comp.id as company_id,
        comp.name as company_name,
        comp.created_at as company_created_at,
        comp.updated_at as company_updated_at,

        st.id as store_id,
        st.name as store_name,
        st.created_at as store_created_at,
        st.updated_at as store_updated_at,

        (SELECT SUM(amount) FROM payments WHERE paymentable_id = s.id AND paymentable_type LIKE '%Sale%') as paid_amount
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN companies comp ON s.company_id = comp.id
      LEFT JOIN stores st ON s.store_id = st.id
      WHERE 1=1
    `;

    if (company_id && company_id !== "") {
      query += ` AND s.company_id = ${company_id}`;
    }

    if (customer_id && customer_id !== "") {
      query += ` AND s.customer_id = ${customer_id}`;
    }

    if (keyword && keyword !== "") {
      query += ` AND (
        s.reference_no LIKE '%${keyword}%'
        OR s.timestamp LIKE '%${keyword}%'
        OR s.company_id IN (SELECT id FROM companies WHERE name LIKE '%${keyword}%')
        OR s.store_id IN (SELECT id FROM stores WHERE name LIKE '%${keyword}%')
        OR c.name LIKE '%${keyword}%'
        OR c.company LIKE '%${keyword}%'
        OR u.username LIKE '%${keyword}%'
        OR CONCAT(u.first_name, ' ', u.last_name) LIKE '%${keyword}%'
      )`;
    }

    if (startDate && startDate !== "" && endDate && endDate !== "") {
      if (startDate === endDate) {
        query += ` AND DATE(s.timestamp) = '${startDate}'`;
      } else {
        query += ` AND s.timestamp BETWEEN '${startDate}' AND '${endDate}'`;
      }
    } else if (startDate && startDate !== "") {
      query += ` AND s.timestamp >= '${startDate}'`;
    } else if (endDate && endDate !== "") {
      query += ` AND s.timestamp <= '${endDate}'`;
    }

    const [countResult] = await db.query(query);
    const total = countResult.length;

    const sortOrder = sort_by_date.toLowerCase() === "asc" ? "ASC" : "DESC";
    query += ` ORDER BY s.timestamp ${sortOrder}`;

    const offset = (page - 1) * per_page;
    query += ` LIMIT ${per_page} OFFSET ${offset}`;

    const [sales] = await db.query(query);

    // Transform the sales data to nest customer and user information
    const transformedSales = sales.map((sale) => {
      const customer = sale.customer_id
        ? {
            id: sale.customer_id,
            name: sale.customer_name,
            company: sale.customer_company,
            email: sale.customer_email,
            phone_number: sale.customer_phone_number,
            address: sale.customer_address,
            city: sale.customer_city,
            created_at: sale.customer_created_at,
            updated_at: sale.customer_updated_at,
          }
        : null;

      const user = sale.user_id
        ? {
            id: sale.user_id,
            username: sale.user_username,
            first_name: sale.user_first_name,
            last_name: sale.user_last_name,
            email: sale.user_email,
            phone_number: sale.user_phone_number,
            role: sale.user_role,
            status: sale.user_status,
            company: {
              id: sale.company_id,
              name: sale.company_name,
            },
          }
        : null;

      const company = sale.company_id
        ? {
            id: sale.company_id,
            name: sale.company_name,
            created_at: sale.company_created_at,
            updated_at: sale.company_updated_at,
          }
        : null;

      const store = sale.store_id
        ? {
            id: sale.store_id,
            name: sale.store_name,
            created_at: sale.store_created_at,
            updated_at: sale.store_updated_at,
            company: {
              id: sale.company_id,
              name: sale.company_name,
            },
          }
        : null;

      // Remove joined fields from the sale object
      [
        "customer_id",
        "customer_name",
        "customer_company",
        "customer_email",
        "customer_phone_number",
        "customer_address",
        "customer_city",
        "customer_created_at",
        "customer_updated_at",
        "user_username",
        "user_first_name",
        "user_last_name",
        "user_email",
        "user_phone_number",
        "user_role",
        "user_status",
      ].forEach((field) => delete sale[field]);

      return {
        ...sale,
        customer,
        user,
        company,
        store,
      };
    });

    // Fetch orders for each sale
    for (const sale of transformedSales) {
      const [orders] = await db.query(
        `
        SELECT o.*,
          p.id as 'product.id', p.name as 'product.name', p.code as 'product.code',
          p.unit as 'product.unit', p.cost as 'product.cost', p.price as 'product.price',
          p.alert_quantity as 'product.alert_quantity', p.created_at as 'product.created_at',
          p.updated_at as 'product.updated_at'
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        WHERE o.orderable_id = ? AND o.orderable_type LIKE '%Sale%'
        `,
        [sale.id]
      );

      sale.orders = orders.map((order) => {
        const product = {};
        Object.keys(order).forEach((key) => {
          if (key.startsWith("product.")) {
            product[key.replace("product.", "")] = order[key];
            delete order[key];
          }
        });
        return {
          ...order,
          product: product,
        };
      });
    }

    const last_page = Math.ceil(total / per_page);
    const path = `${req.protocol}://${req.get("host")}${req.baseUrl}${
      req.path
    }`;

    const response = {
      status: "Success",
      data: {
        current_page: parseInt(page),
        data: transformedSales,
        first_page_url: `${path}?${buildQueryString({
          ...req.query,
          page: 1,
        })}`,
        from: offset + 1,
        last_page,
        last_page_url: `${path}?${buildQueryString({
          ...req.query,
          page: last_page,
        })}`,
        next_page_url:
          page < last_page
            ? `${path}?${buildQueryString({
                ...req.query,
                page: parseInt(page) + 1,
              })}`
            : null,
        path,
        per_page: parseInt(per_page),
        prev_page_url:
          page > 1
            ? `${path}?${buildQueryString({ ...req.query, page: page - 1 })}`
            : null,
        to: Math.min(offset + per_page, total),
        total,
      },
      message: null,
    };

    return response;
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      data: null,
      message: "An error occurred while searching sales",
    };
  }
};

function buildQueryString(params) {
  return Object.keys(params)
    .filter(
      (key) =>
        params[key] !== "" && params[key] !== undefined && params[key] !== null
    )
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");
}

exports.getSaleDetail = async (req) => {
  try {
    const { saleId } = req.query;

    const [saleRows] = await db.query(`SELECT * FROM sales WHERE id = ?`, [
      saleId,
    ]);

    if (saleRows.length === 0) {
      throw new Error("Sale not found");
    }

    const sale = saleRows[0];

    const [
      [userRows],
      [ordersRows],
      [paymentsRows],
      [imagesRows],
      [companyRows],
      [customerRows],
      [storeRows],
      [billerRows],
      [productRows],
      [paymentImagesRows],
    ] = await Promise.all([
      db.query(`SELECT * FROM users WHERE id = ?`, [sale.user_id]),
      db.query(
        `SELECT o.* FROM orders o WHERE o.orderable_id = ? AND o.orderable_type = 'App\\\\Models\\\\Sale'`,
        [saleId]
      ),
      db.query(
        `SELECT * FROM payments WHERE paymentable_id = ? AND paymentable_type = 'App\\\\Models\\\\Sale'`,
        [saleId]
      ),
      db.query(
        `SELECT * FROM images WHERE imageable_id = ? AND imageable_type = 'App\\\\Models\\\\Sale'`,
        [saleId]
      ),
      db.query(`SELECT * FROM companies WHERE id = ?`, [sale.company_id]),
      db.query(`SELECT * FROM customers WHERE id = ?`, [sale.customer_id]),
      db.query(`SELECT * FROM stores WHERE id = ?`, [sale.store_id]),
      db.query(`SELECT * FROM users WHERE id = ?`, [sale.biller_id]),
      db.query(`SELECT * FROM products`),
      db.query(
        `SELECT * FROM images WHERE imageable_type = 'App\\Models\\Payment'`
      ),
    ]);

    const paidAmount = paymentsRows
      .filter((item) => item.status === 1)
      .reduce((sum, item) => sum + (item.amount || 0), 0);

    const productMap = Object.fromEntries(productRows.map((p) => [p.id, p]));
    ordersRows.forEach((order) => {
      order.product = productMap[order.product_id] || null;
    });

    paymentsRows.forEach((payment) => {
      payment.images = paymentImagesRows.filter(
        (img) => img.imageable_id === payment.id
      );
    });

    sale.user = userRows[0] || null;
    sale.orders = ordersRows;
    sale.payments = paymentsRows;
    sale.images = imagesRows;
    sale.company = companyRows[0] || null;
    sale.customer = customerRows[0] || null;
    sale.store = storeRows[0] || null;
    sale.biller = billerRows[0] || null;

    sale.paid_amount = paidAmount;

    return {
      status: "success",
      data: sale,
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
    const userRole = req.user?.role || "admin"; // fallback if role not in req

    if (!id) {
      throw new Error("Missing sale ID");
    }

    const [[sale]] = await db.query(`SELECT * FROM sales WHERE id = ?`, [id]);

    if (!sale) {
      throw new Error("Sale not found");
    }

    const allowedRoles = ["user", "admin"];
    if (sale.status === 0) allowedRoles.push("secretary");

    if (!allowedRoles.includes(userRole)) {
      throw new Error("You are not allowed to perform this action");
    }

    await db.query(
      `DELETE FROM orders WHERE orderable_id = ? AND orderable_type = 'App\\\\Models\\\\Sale'`,
      [id]
    );

    await db.query(
      `DELETE FROM payments WHERE paymentable_id = ? AND paymentable_type = 'App\\\\Models\\\\Sale'`,
      [id]
    );

    await db.query(`DELETE FROM sales WHERE id = ?`, [id]);

    if (sale.status === 0 && userRole === "admin") {
      await db.query(
        `INSERT INTO notifications (
          user_id,
          company_id,
          reference_no,
          supplier,
          amount,
          message,
          notifiable_id,
          notifiable_type,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          sale.company_id,
          sale.reference_no,
          "", // No supplier info in sales table
          sale.grand_total,
          "sale_rejected",
          sale.id,
          "App\\\\Models\\\\Sale",
        ]
      );
    }

    return { status: "success" };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message,
    };
  }
};
