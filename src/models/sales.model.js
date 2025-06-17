const db = require("../config/db");
const moment = require("moment");
const path = require("path");
const { v4 } = require("uuid");
const slugify = require("slugify");
const { putObject } = require("../utils/putObject");

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

    const transformedSales = await Promise.all(
      sales.map(async (sale) => {
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

        const [images] = await db.query(
          `SELECT * FROM images WHERE imageable_id = ? AND imageable_type LIKE '%Sale%'`,
          [sale.id]
        );

        const [payments] = await db.query(
          `SELECT * FROM payments WHERE paymentable_id = ? AND paymentable_type LIKE '%Sale%'`,
          [sale.id]
        );

        return {
          ...sale,
          customer,
          user,
          company,
          store,
          images,
          payments,
        };
      })
    );

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
    const userRole = req.user?.role || "admin";

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

    return { status: "success" };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message,
    };
  }
};

exports.create = async (req) => {
  try {
    const {
      date,
      reference_no,
      store,
      customer,
      grand_total,
      note = "",
      orders_json,
    } = req.body;

    if (!date || !reference_no || !store || !customer) {
      throw new Error(
        "Missing required fields: date, reference_no, store, customer"
      );
    }

    const orders = JSON.parse(orders_json || "[]");
    if (orders.length === 0) {
      throw new Error("Please select at least one product");
    }

    const [existingSale] = await db.query(
      "SELECT id FROM sales WHERE reference_no = ? AND customer_id = ?",
      [reference_no, customer]
    );
    if (existingSale.length > 0) {
      throw new Error("Reference number already taken");
    }

    const user_id = req.user?.id || 1;
    const user_role = req.user?.role || "user";

    console.log(user_id);

    const [storeData] = await db.query(
      "SELECT id, company_id FROM stores WHERE id = ?",
      [store]
    );
    if (storeData.length === 0) {
      throw new Error("Store not found");
    }
    const { company_id } = storeData[0];

    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");

    const [saleInsert] = await db.query(
      `INSERT INTO sales (user_id, biller_id, timestamp, reference_no, store_id, company_id, customer_id, note, status, grand_total, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        user_id,
        user_id,
        timestamp,
        reference_no,
        store,
        company_id,
        customer,
        note,
        user_role !== "secretary" ? 1 : 0,
        grand_total,
      ]
    );

    const sale_id = saleInsert.insertId;

    if (req.files && req.files.attachment) {
      const attachments = Array.isArray(req.files.attachment)
        ? req.files.attachment
        : [req.files.attachment];

      const [companyData] = await db.query(
        `SELECT name FROM companies WHERE id = ?`,
        [company_id]
      );
      const [customerData] = await db.query(
        `SELECT company FROM customers WHERE id = ?`,
        [customer]
      );

      const company_name = companyData[0]?.name || "";
      const customer_slug = slugify(customerData[0]?.company || "", {
        lower: true,
      });

      for (let file of attachments) {
        const ext = path.extname(file.name);
        const filename = `${company_name}_${reference_no}_${customer_slug}_${v4()}${ext}`;

        const { key } = await putObject(file.data, `sales/${filename}`);

        await db.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [`/${key}`, sale_id, "App\\Models\\Sale"]
        );
      }
    }

    for (const item of orders) {
      const subtotal = parseInt(item.price) * parseInt(item.quantity);

      await db.query(
        `INSERT INTO orders (product_id, price, quantity, subtotal, orderable_id, orderable_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          item.product_id,
          item.price,
          item.quantity,
          subtotal,
          sale_id,
          "App\\Models\\Sale",
        ]
      );

      const [storeProductRows] = await db.query(
        "SELECT id, quantity FROM store_products WHERE store_id = ? AND product_id = ?",
        [store, item.product_id]
      );

      if (
        storeProductRows.length > 0 &&
        storeProductRows[0].quantity >= item.quantity
      ) {
        await db.query(
          "UPDATE store_products SET quantity = quantity - ? WHERE id = ?",
          [item.quantity, storeProductRows[0].id]
        );
      }
    }

    return {
      status: "success",
      sale_id,
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Something went wrong");
  }
};

exports.update = async (req) => {
  try {
    const {
      id,
      date,
      reference_no,
      customer,
      note = "",
      grand_total,
      orders_json = "[]",
    } = req.body;

    if (!id || !date || !reference_no || !customer) {
      throw new Error(
        "Missing required fields: id, date, reference_no, customer"
      );
    }

    const orders = JSON.parse(orders_json);

    if (orders.length === 0) {
      throw new Error("Please select at least one product");
    }

    const [duplicate] = await db.query(
      "SELECT id FROM sales WHERE reference_no = ? AND id != ? AND customer_id = ?",
      [reference_no, id, customer]
    );
    if (duplicate.length > 0) {
      throw new Error("Reference number already taken");
    }

    const [[saleRow]] = await db.query(
      "SELECT store_id FROM sales WHERE id = ?",
      [id]
    );
    if (!saleRow) throw new Error("Sale not found");

    const store_id = saleRow.store_id;

    const [[storeRow]] = await db.query(
      "SELECT company_id FROM stores WHERE id = ?",
      [store_id]
    );
    if (!storeRow) throw new Error("Store not found");

    const company_id = storeRow.company_id;
    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");

    await db.query(
      `UPDATE sales SET 
       timestamp = ?, 
       reference_no = ?, 
       company_id = ?, 
       customer_id = ?, 
       note = ?, 
       grand_total = ?, 
       updated_at = NOW() 
       WHERE id = ?`,
      [timestamp, reference_no, company_id, customer, note, grand_total, id]
    );

    if (req.files && req.files.attachment) {
      await db.query(
        `DELETE FROM images WHERE imageable_id = ? AND imageable_type = ?`,
        [id, "App\\Models\\Sale"]
      );

      const attachments = Array.isArray(req.files.attachment)
        ? req.files.attachment
        : [req.files.attachment];

      const [[companyRow]] = await db.query(
        "SELECT name FROM companies WHERE id = ?",
        [company_id]
      );
      const [[customerRow]] = await db.query(
        "SELECT name FROM customers WHERE id = ?",
        [customer]
      );

      const company_name = companyRow?.name || "";
      const customer_slug = slugify(customerRow?.name || "", {
        lower: true,
      });
      const date_time = moment().format("YYYYMMDDHHmmss");

      for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        const ext = path.extname(file.name);
        const filename = `${company_name}_${reference_no}_${customer_slug}_${date_time}_${i}${ext}`;
        const { key } = await putObject(file.data, `sales/${filename}`);

        await db.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
          [`/${key}`, id, "App\\Models\\Sale"]
        );
      }
    }

    const [existingOrders] = await db.query(
      `SELECT id FROM orders WHERE orderable_id = ? AND orderable_type = 'App\\\\Models\\\\Sale'`,
      [id]
    );

    const existingIds = existingOrders.map((o) => o.id);
    const incomingIds = orders.map((o) => o.id).filter(Boolean);

    const deleteIds = existingIds.filter((eid) => !incomingIds.includes(eid));
    if (deleteIds.length > 0) {
      await db.query(
        `DELETE FROM orders WHERE id IN (${deleteIds
          .map(() => "?")
          .join(",")})`,
        deleteIds
      );
    }

    for (const item of orders) {
      const subtotal = item.price * item.quantity;

      if (!item.id) {
        await db.query(
          `INSERT INTO orders (product_id, price, quantity, subtotal, orderable_id, orderable_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            item.product_id,
            item.price,
            item.quantity,
            subtotal,
            id,
            "App\\Models\\Sale",
          ]
        );

        const [[storeProduct]] = await db.query(
          `SELECT id FROM store_products WHERE store_id = ? AND product_id = ?`,
          [store_id, item.product_id]
        );

        if (storeProduct) {
          await db.query(
            `UPDATE store_products SET quantity = quantity - ? WHERE id = ?`,
            [item.quantity, storeProduct.id]
          );
        } else {
          throw new Error(
            `Product (ID: ${item.product_id}) not available in this store`
          );
        }
      } else {
        const [[oldOrder]] = await db.query(
          `SELECT quantity FROM orders WHERE id = ?`,
          [item.id]
        );

        await db.query(
          `UPDATE orders SET product_id = ?, price = ?, quantity = ?, subtotal = ?, updated_at = NOW() WHERE id = ?`,
          [item.product_id, item.price, item.quantity, subtotal, item.id]
        );

        if (oldOrder.quantity !== item.quantity) {
          const [[storeProduct]] = await db.query(
            `SELECT id FROM store_products WHERE store_id = ? AND product_id = ?`,
            [store_id, item.product_id]
          );

          if (storeProduct) {
            await db.query(
              `UPDATE store_products SET quantity = quantity + ? - ? WHERE id = ?`,
              [oldOrder.quantity, item.quantity, storeProduct.id]
            );
          }
        }
      }
    }

    return {
      status: "success",
      sale_id: id,
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
};

exports.allSales = async (req) => {
  try {
    if (!req.user || !req.user.id) {
      throw new Error("Unauthorized: User not authenticated");
    }

    let query = `
      SELECT
        s.*,
        c.name AS company_name,
        st.name AS store_name,
        cu.company AS customer_company,
        cu.name AS customer_name,
        cu.email AS customer_email,
        cu.phone_number AS customer_phone,
        cu.address AS customer_address,
        cu.city AS customer_city,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.email AS user_email,
        u.phone_number AS user_phone,
        u.role AS user_role
      FROM sales s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN stores st ON s.store_id = st.id
      LEFT JOIN customers cu ON s.customer_id = cu.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (req.user.role === "user" || req.user.role === "secretary") {
      query += ` AND s.company_id = ?`;
      params.push(req.user.company_id);
    }

    if (req.query) {
      if (req.query.company_id) {
        query += ` AND s.company_id = ?`;
        params.push(req.query.company_id);
      }

      if (req.query.reference_no) {
        query += ` AND s.reference_no LIKE ?`;
        params.push(`%${req.query.reference_no}%`);
      }

      if (req.query.customer_id) {
        query += ` AND s.customer_id = ?`;
        params.push(req.query.customer_id);
      }

      if (req.query.store_id) {
        query += ` AND s.store_id = ?`;
        params.push(req.query.store_id);
      }

      if (req.query.period) {
        const period = req.query.period;
        const from = period.substring(0, 10);
        const to = period.substring(14, 10);

        if (from && to) {
          query += ` AND s.timestamp BETWEEN ? AND ?`;
          params.push(from, to);
        }
      }

      if (req.query.startDate && req.query.endDate) {
        if (req.query.startDate === req.query.endDate) {
          query += ` AND DATE(s.timestamp) = ?`;
          params.push(req.query.startDate);
        } else {
          query += ` AND s.timestamp BETWEEN ? AND ?`;
          params.push(req.query.startDate, req.query.endDate);
        }
      }

      if (req.query.keyword) {
        const keywordLike = `%${req.query.keyword}%`;

        const [companyIds] = await db.query(
          `SELECT id FROM companies WHERE name LIKE ?`,
          [keywordLike]
        );

        const [customerIds] = await db.query(
          `SELECT id FROM customers WHERE company LIKE ?`,
          [keywordLike]
        );

        const [storeIds] = await db.query(
          `SELECT id FROM stores WHERE name LIKE ?`,
          [keywordLike]
        );

        const companyIdList = companyIds.map((item) => item.id);
        const customerIdList = customerIds.map((item) => item.id);
        const storeIdList = storeIds.map((item) => item.id);

        query += ` AND (
          s.reference_no LIKE ? OR
          s.timestamp LIKE ? OR
          s.grand_total LIKE ?`;

        params.push(keywordLike, keywordLike, keywordLike);

        if (companyIdList.length > 0) {
          query += ` OR s.company_id IN (${companyIdList
            .map(() => "?")
            .join(",")})`;
          params.push(...companyIdList);
        }

        if (customerIdList.length > 0) {
          query += ` OR s.customer_id IN (${customerIdList
            .map(() => "?")
            .join(",")})`;
          params.push(...customerIdList);
        }

        if (storeIdList.length > 0) {
          query += ` OR s.store_id IN (${storeIdList
            .map(() => "?")
            .join(",")})`;
          params.push(...storeIdList);
        }

        query += `)`;
      }
    }

    const sortByDate = req.query?.sort_by_date || "desc";
    query += ` ORDER BY s.timestamp ${sortByDate === "asc" ? "ASC" : "DESC"}`;

    const [salesRows] = await db.query(query, params);

    if (!salesRows.length) {
      return {
        status: "success",
        data: [],
      };
    }

    const saleIds = salesRows.map((row) => row.id);

    const [orders] = await db.query(
      `SELECT o.*, o.orderable_id AS sale_id,
              p.name AS product_name,
              p.code AS product_code,
              p.unit AS product_unit,
              p.cost AS product_cost,
              p.price AS product_price
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       WHERE o.orderable_type = 'App\\\\Models\\\\Sale'
         AND o.orderable_id IN (${saleIds.map(() => "?").join(",")})
      `,
      saleIds
    );

    const [payments] = await db.query(
      `SELECT *, paymentable_id AS sale_id
       FROM payments
       WHERE paymentable_type = 'App\\\\Models\\\\Sale'
         AND paymentable_id IN (${saleIds.map(() => "?").join(",")})
      `,
      saleIds
    );

    const [images] = await db.query(
      `SELECT *, imageable_id AS sale_id,
              CONCAT('http://your-domain.com/storage', path) AS src,
              'image' AS type
       FROM images
       WHERE imageable_type = 'App\\\\Models\\\\Sale'
         AND imageable_id IN (${saleIds.map(() => "?").join(",")})
      `,
      saleIds
    );

    const mapById = (items, key = "sale_id") => {
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
    const imageMap = mapById(images);

    const enrichedSales = salesRows.map((row) => {
      const totalPaid = (paymentMap[row.id] || []).reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );

      return {
        ...row,
        total_amount: row.grand_total,
        paid_amount: totalPaid,
        orders: (orderMap[row.id] || []).map((order) => ({
          ...order,
          product: {
            id: order.product_id,
            name: order.product_name,
            code: order.product_code,
            unit: order.product_unit,
            cost: order.product_cost,
            price: order.product_price,
          },
        })),
        payments: paymentMap[row.id] || [],
        images: imageMap[row.id] || [],
        company: {
          id: row.company_id,
          name: row.company_name,
        },
        customer: {
          id: row.customer_id,
          name: row.customer_name,
          company: row.customer_company,
          email: row.customer_email,
          phone_number: row.customer_phone,
          address: row.customer_address,
          city: row.customer_city,
        },
        store: {
          id: row.store_id,
          name: row.store_name,
          company: {
            id: row.company_id,
            name: row.company_name,
          },
        },
        user: {
          id: row.user_id,
          username: row.user_username,
          first_name: row.user_first_name,
          last_name: row.user_last_name,
          email: row.user_email,
          phone_number: row.user_phone,
          role: row.user_role,
          name: `${row.user_first_name || ""} ${
            row.user_last_name || ""
          }`.trim(),
        },
      };
    });

    return {
      status: "success",
      data: enrichedSales,
    };
  } catch (error) {
    console.error(error);

    if (error.message.includes("Unauthorized")) {
      return {
        status: "error",
        message: error.message,
        code: 401,
        data: [],
      };
    }

    return {
      status: "error",
      message: "Failed to retrieve sales",
      code: 500,
      data: [],
    };
  }
};
