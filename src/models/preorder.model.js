const db = require("../config/db");
const path = require("path");
const moment = require("moment");
const slugify = require("slugify");
const { v4 } = require("uuid");
const { putObject } = require("../utils/putObject");

exports.searchPurchaseOrders = async (req) => {
  try {
    const values = [];
    const filterConditions = [];

    if (req.user && req.user?.role !== "admin") {
      filterConditions.push("po.company_id = ?");
      values.push(req.user.company_id);
    }

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
        const start = `${req.query.startDate} 00:00:00`;
        const end = `${req.query.endDate} 23:59:59`;
        filterConditions.push("po.timestamp BETWEEN ? AND ?");
        values.push(start, end);
      } else {
        const start = `${req.query.startDate} 00:00:00`;
        const end = `${req.query.endDate} 23:59:59`;
        filterConditions.push("po.timestamp BETWEEN ? AND ?");
        values.push(start, end);
      }
    }

    if (req.query.keyword) {
      filterConditions.push(`
        (
          CAST(po.reference_no AS CHAR) LIKE ?
          OR s.name LIKE ?
          OR s.company LIKE ?
        )
      `);
      values.push(
        `%${req.query.keyword.toString()}%`,
        `%${req.query.keyword}%`,
        `%${req.query.keyword}%`
      );
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const perPage = parseInt(req.query.per_page) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM pre_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const orderQuery = `
      SELECT po.*, s.name AS supplier_name, s.email AS supplier_email, s.company AS supplier_company
      FROM pre_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      ${whereClause}
      ORDER BY po.timestamp DESC
      LIMIT ? OFFSET ?
    `;
    const orderValues = [...values, perPage, offset];

    const [purchaseOrderRows] = await db.query(orderQuery, orderValues);

    const baseUrl =
      req.query.base_url || "http://your-domain.com/api/purchase_order/search";

    const purchaseOrderIds = purchaseOrderRows.map((po) => po.id);

    if (!purchaseOrderIds.length) {
      return {
        status: "Success",
        data: {
          current_page: page,
          data: [],
          first_page_url: `${baseUrl}?page=1&per_page=${perPage}`,
          from: 0,
          last_page: 0,
          last_page_url: `${baseUrl}?page=1&per_page=${perPage}`,
          links: [],
          next_page_url: null,
          path: baseUrl,
          per_page: perPage,
          prev_page_url: null,
          to: 0,
          total: 0,
        },
        message: null,
      };
    }

    const [orderItems] = await db.query(
      `
      SELECT poi.*, poi.pre_order_id, cat.id AS category_id, cat.name AS category_name
      FROM pre_order_items poi
      LEFT JOIN categories cat ON cat.id = poi.category_id
      WHERE poi.pre_order_id IN (?)
    `,
      [purchaseOrderIds]
    );

    const preOrderItemIds = orderItems.map((item) => item.id);

    const [orderImages] = await db.query(
      `SELECT imageable_id, path FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseOrder' AND imageable_id IN (?)`,
      [purchaseOrderIds]
    );
    const orderImagesMap = orderImages.reduce((map, img) => {
      if (!map[img.imageable_id]) map[img.imageable_id] = [];
      map[img.imageable_id].push(img.path);
      return map;
    }, {});

    const [itemImages] = await db.query(
      `SELECT imageable_id, path FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseOrderItem' AND imageable_id IN (?)`,
      [preOrderItemIds]
    );
    const itemImagesMap = itemImages.reduce((map, img) => {
      if (!map[img.imageable_id]) map[img.imageable_id] = [];
      map[img.imageable_id].push(img.path);
      return map;
    }, {});

    const orderItemsMap = orderItems.reduce((map, item) => {
      if (!map[item.pre_order_id]) {
        map[item.pre_order_id] = [];
      }
      map[item.pre_order_id].push(item);
      return map;
    }, {});

    const [purchaseData] = await db.query(
      `
      SELECT purchase_order_id, SUM(total_amount) AS received_amount
      FROM purchase_orders
      WHERE purchase_order_id IN (?)
      GROUP BY purchase_order_id
    `,
      [purchaseOrderIds]
    );

    const purchaseMap = purchaseData.reduce((map, data) => {
      map[data.purchase_order_id] = data.received_amount;
      return map;
    }, {});

    const [itemReceivedQuantities] = preOrderItemIds.length
      ? await db.query(
          `
          SELECT purchase_order_item_id, SUM(quantity) AS received_quantity
          FROM purchase_order_items
          WHERE purchase_order_item_id IN (?)
          GROUP BY purchase_order_item_id
        `,
          [preOrderItemIds]
        )
      : [[]];

    const itemReceivedMap = itemReceivedQuantities.reduce((map, row) => {
      map[row.purchase_order_item_id] = row.received_quantity;
      return map;
    }, {});

    const enrichedPurchaseOrders = purchaseOrderRows.map((po) => ({
      ...po,
      attachments: orderImagesMap[po.id] || [],
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
        images: itemImagesMap[item.id] || [],
        received_quantity: itemReceivedMap[item.id] || "0",
      })),
    }));

    const totalPages = Math.ceil(total / perPage);

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

exports.create = async (req) => {
  try {
    const {
      date,
      reference_no,
      supplier,
      discount,
      note = "",
      total_amount,
      items_json,
    } = req.body;

    if (!date || !reference_no || !supplier || !discount) {
      throw new Error("Missing required fields");
    }

    if (!req.user || !req.user.id) {
      throw new Error("Unauthorized");
    }

    const decodedItems = JSON.parse(items_json || "[]");
    if (!Array.isArray(decodedItems) || decodedItems.length === 0) {
      throw new Error("Please provide at least one item");
    }

    const [existing] = await db.query(
      `SELECT id FROM pre_orders WHERE reference_no = ? AND supplier_id = ?`,
      [reference_no, supplier]
    );
    if (existing.length > 0) {
      throw new Error("Reference number already taken");
    }

    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");
    const user_id = req.user.id;
    const company_id = req.user.company_id;

    const [preOrderInsert] = await db.query(
      `INSERT INTO pre_orders (user_id, timestamp, reference_no, company_id, supplier_id, discount_string, note, grand_total, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        user_id,
        timestamp,
        reference_no,
        company_id,
        supplier,
        discount,
        note,
        total_amount,
      ]
    );

    const pre_order_id = preOrderInsert.insertId;

    if (req.files && req.files.attachment) {
      const attachments = Array.isArray(req.files.attachment)
        ? req.files.attachment
        : [req.files.attachment];

      const [supplierData] = await db.query(
        `SELECT company FROM suppliers WHERE id = ?`,
        [supplier]
      );
      const supplier_slug = slugify(supplierData[0]?.company || "", {
        lower: true,
      });

      for (const file of attachments) {
        const ext = path.extname(file.name);
        const filename = `pre_orders/${company_id}_${reference_no}_${supplier_slug}_${v4()}${ext}`;

        const { key } = await putObject(file.data, filename);

        await db.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [`/${key}`, pre_order_id, "App\\Models\\PurchaseOrder"]
        );
      }
    }

    const imageMap = {};
    for (const field in req.files) {
      const match = field.match(/^images\[(\d+)\]/);

      if (match) {
        const index = match[1];
        imageMap[index] = Array.isArray(req.files[field])
          ? req.files[field]
          : [req.files[field]];
      }
    }

    for (let i = 0; i < decodedItems.length; i++) {
      const item = decodedItems[i];
      const { product_name, product_cost, quantity, discount, category } = item;

      const _cost = Number(product_cost) || 0;
      const _qty = Number(quantity) || 0;

      let discountValue = 0;
      if (typeof discount === "string" && discount.trim().endsWith("%")) {
        const percent = Number(discount.trim().replace("%", ""));
        if (!isNaN(percent)) discountValue = (_cost * percent) / 100;
      } else {
        const flat = Number(discount);
        if (!isNaN(flat)) discountValue = flat;
      }

      const subTotal = (_cost - discountValue) * _qty;

      const [itemInsert] = await db.query(
        `INSERT INTO pre_order_items (pre_order_id, product, cost, quantity, discount, discount_string, category_id, subtotal, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          pre_order_id,
          product_name,
          _cost,
          _qty,
          discountValue,
          discount,
          category,
          subTotal,
        ]
      );

      const pre_order_item_id = itemInsert.insertId;
      const images = imageMap[i] || [];

      for (const img of images) {
        const ext = path.extname(img.name);
        const filename = `pre_order_items/${company_id}_${reference_no}_${v4()}${ext}`;
        const { key } = await putObject(img.data, filename);

        await db.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [`/${key}`, pre_order_item_id, "App\\Models\\PurchaseOrderItem"]
        );
      }
    }

    return {
      status: "success",
      pre_order_id,
    };
  } catch (error) {
    console.error("PreOrder Error:", error.message);
    return {
      status: "error",
      message: error.message,
      code:
        error.message.includes("Missing") ||
        error.message.includes("Unauthorized") ||
        error.message.includes("Reference")
          ? 422
          : 500,
    };
  }
};

exports.update = async (req) => {
  try {
    const {
      id,
      imageEditable,
      date,
      reference_no,
      supplier,
      discount,
      note = "",
      total_amount,
      items_json,
    } = req.body;

    if (!id || !date || !reference_no || !supplier || !discount) {
      throw new Error("Missing required fields");
    }

    if (!req.user || !req.user.id) {
      throw new Error("Unauthorized");
    }

    const decodedItems = JSON.parse(items_json || "[]");
    if (!Array.isArray(decodedItems) || decodedItems.length === 0) {
      throw new Error("Please provide at least one item");
    }

    const [existing] = await db.query(
      `SELECT id FROM pre_orders WHERE reference_no = ? AND supplier_id = ? AND id != ?`,
      [reference_no, supplier, id]
    );
    if (existing.length > 0) {
      throw new Error("Reference number already taken");
    }

    const timestamp = moment(date).format("YYYY-MM-DD HH:mm:ss");
    const company_id = req.user.company_id;

    await db.query(
      `UPDATE pre_orders SET timestamp = ?, reference_no = ?, supplier_id = ?, discount_string = ?, note = ?, grand_total = ?, updated_at = NOW()
       WHERE id = ?`,
      [timestamp, reference_no, supplier, discount, note, total_amount, id]
    );

    await db.query(`DELETE FROM pre_order_items WHERE pre_order_id = ?`, [id]);

    if (imageEditable === "true") {
      if (req.files && req.files.attachment) {
        const attachments = Array.isArray(req.files.attachment)
          ? req.files.attachment
          : [req.files.attachment];

        const [supplierData] = await db.query(
          `SELECT company FROM suppliers WHERE id = ?`,
          [supplier]
        );
        const supplier_slug = slugify(supplierData[0]?.company || "", {
          lower: true,
        });

        for (const file of attachments) {
          const ext = path.extname(file.name);
          const filename = `pre_orders/${company_id}_${reference_no}_${supplier_slug}_${v4()}${ext}`;

          const { key } = await putObject(file.data, filename);

          await db.query(
            `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
            [`/${key}`, pre_order_id, "App\\Models\\PurchaseOrder"]
          );
        }
      } else {
        await db.query(
          `DELETE FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseOrder' AND imageable_id = ?`,
          [id]
        );
      }
    }

    const imageMap = {};
    for (const field in req.files) {
      const match = field.match(/^images\[(\d+)\]/);
      if (match) {
        const index = match[1];
        imageMap[index] = Array.isArray(req.files[field])
          ? req.files[field]
          : [req.files[field]];
      }
    }

    for (let i = 0; i < decodedItems.length; i++) {
      const item = decodedItems[i];
      const {
        product_name,
        product_cost,
        quantity,
        discount,
        category,
        imageEditable,
        original_id,
      } = item;

      const _cost = Number(product_cost) || 0;
      const _qty = Number(quantity) || 0;

      let discountValue = 0;
      if (typeof discount === "string" && discount.trim().endsWith("%")) {
        const percent = Number(discount.trim().replace("%", ""));
        if (!isNaN(percent)) discountValue = (_cost * percent) / 100;
      } else {
        const flat = Number(discount);
        if (!isNaN(flat)) discountValue = flat;
      }

      const subTotal = (_cost - discountValue) * _qty;

      const [itemInsert] = await db.query(
        `INSERT INTO pre_order_items (pre_order_id, product, cost, quantity, discount, discount_string, category_id, subtotal, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          product_name,
          _cost,
          _qty,
          discountValue,
          discount,
          category,
          subTotal,
        ]
      );

      const pre_order_item_id = itemInsert.insertId;
      const images = imageMap[i] || [];

      if (imageEditable === true || imageEditable === "true") {
        await db.query(
          `DELETE FROM images WHERE imageable_type = 'App\\Models\\PurchaseOrderItem' AND imageable_id = ?`,
          [original_id]
        );

        for (const img of images) {
          const ext = path.extname(img.name);
          const filename = `pre_order_items/${company_id}_${reference_no}_${v4()}${ext}`;
          const { key } = await putObject(img.data, filename);

          await db.query(
            `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
             VALUES (?, ?, ?, NOW(), NOW())`,
            [`/${key}`, pre_order_item_id, "App\\Models\\PurchaseOrderItem"]
          );
        }
      } else {
        await db.query(
          `UPDATE images SET imageable_id = ? WHERE imageable_id = ?`,
          [pre_order_item_id, original_id]
        );
      }
    }

    return {
      status: "success",
      pre_order_id: id,
    };
  } catch (error) {
    console.error("Update PreOrder Error:", error.message);
    return {
      status: "error",
      message: error.message,
      code:
        error.message.includes("Missing") ||
        error.message.includes("Unauthorized") ||
        error.message.includes("Reference")
          ? 422
          : 500,
    };
  }
};

exports.delete = async (req) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    if (!id) throw new Error("Missing purchase order ID");

    const [userCheck] = await connection.query(
      `SELECT role FROM users WHERE id = ?`,
      [req.user?.id]
    );
    if (userCheck[0]?.role === "secretary") {
      return {
        status: "error",
        message: "Not allowed",
        code: 403,
      };
    }

    const [checkPurchases] = await connection.query(
      `SELECT id FROM purchase_orders WHERE purchase_order_id = ? LIMIT 1`,
      [id]
    );
    if (checkPurchases.length > 0) {
      return {
        status: "error",
        message:
          "Purchase order cannot be deleted because it has related purchases.",
        code: 400,
      };
    }

    await connection.beginTransaction();

    const [poImages] = await connection.query(
      `SELECT path FROM images WHERE imageable_type = 'App\\Models\\PurchaseOrder' AND imageable_id = ?`,
      [id]
    );
    for (const img of poImages) {
      if (await fileExists(img.path)) {
        await deleteFile(img.path);
      }
    }
    await connection.query(
      `DELETE FROM images WHERE imageable_type = 'App\\Models\\PurchaseOrder' AND imageable_id = ?`,
      [id]
    );

    const [itemImages] = await connection.query(
      `SELECT imageable_id, path FROM images WHERE imageable_type = 'App\\Models\\PurchaseOrderItem' AND imageable_id IN (SELECT id FROM pre_order_items WHERE pre_order_id = ?)`,
      [id]
    );
    for (const img of itemImages) {
      if (await fileExists(img.path)) {
        await deleteFile(img.path);
      }
    }
    await connection.query(
      `DELETE FROM images WHERE imageable_type = 'App\\Models\\PurchaseOrderItem' AND imageable_id IN (SELECT id FROM pre_order_items WHERE pre_order_id = ?)`,
      [id]
    );

    await connection.query(
      `DELETE FROM pre_order_items WHERE pre_order_id = ?`,
      [id]
    );
    await connection.query(`DELETE FROM pre_orders WHERE id = ?`, [id]);

    await connection.commit();
    return {
      status: "success",
      message: "Purchase order deleted",
    };
  } catch (error) {
    await connection.rollback();
    console.error("Delete PreOrder Error:", error.message);
    return {
      status: "error",
      message: error.message,
      code: 500,
    };
  } finally {
    connection.release();
  }
};

exports.receive = async (req) => {
  const connection = await db.getConnection();
  try {
    const { id, reference_no, store, note, shipping_carrier, total_amount } =
      req.body;

    if (!reference_no || !store) {
      throw new Error("Missing required fields");
    }

    const [existing] = await connection.query(
      `SELECT po.supplier_id FROM pre_orders po WHERE po.id = ?`,
      [id]
    );
    if (!existing.length) {
      throw new Error("Invalid purchase order ID");
    }
    const supplier_id = existing[0].supplier_id;

    const [dupRef] = await connection.query(
      `SELECT id FROM purchase_orders WHERE reference_no = ? AND supplier_id = ? LIMIT 1`,
      [reference_no, supplier_id]
    );
    if (dupRef.length > 0) {
      return {
        status: "error",
        message: "Reference number already taken",
        code: 422,
        errors: { reference_no: ["Reference number already taken"] },
      };
    }

    await connection.beginTransaction();

    const [preOrder] = await connection.query(
      `SELECT * FROM pre_orders WHERE id = ? LIMIT 1`,
      [id]
    );
    const po = preOrder[0];

    const store_id = store || po.store_id || null;
    const [insertPurchase] = await connection.query(
      `INSERT INTO purchase_orders (purchase_order_id, user_id, store_id, company_id, supplier_id, reference_no, shipping_carrier, purchased_at, total_amount, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        po.user_id,
        store_id,
        po.company_id,
        po.supplier_id,
        reference_no,
        shipping_carrier,
        po.timestamp,
        total_amount,
        note,
      ]
    );

    const purchase_id = insertPurchase.insertId;
    const items = JSON.parse(req.body.items_json || "[]");

    for (const item of items) {
      const [poi] = await connection.query(
        `SELECT category_id FROM pre_order_items WHERE id = ? LIMIT 1`,
        [item.id]
      );
      const category_id = poi[0]?.category_id;

      const _cost = Number(item.product_cost) || 0;
      const _qty = Number(item.receive) || 0;

      let discountValue = 0;
      if (
        typeof item.discount === "string" &&
        item.discount.trim().endsWith("%")
      ) {
        const percent = Number(item.discount.trim().replace("%", ""));
        if (!isNaN(percent)) discountValue = (_cost * percent) / 100;
      } else {
        const flat = Number(item.discount);
        if (!isNaN(flat)) discountValue = flat;
      }

      const amount = (_cost - discountValue).toFixed() * _qty;

      const [insertItem] = await connection.query(
        `INSERT INTO purchase_order_items (purchase_order_item_id, purchase_id, product, cost, quantity, amount, category_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          item.id,
          purchase_id,
          item.product_name,
          item.product_cost,
          item.receive,
          amount,
          category_id,
        ]
      );

      const purchase_item_id = insertItem.insertId;

      const [images] = await connection.query(
        `SELECT path FROM images WHERE imageable_type = 'App\\Models\\PurchaseOrderItem' AND imageable_id = ?`,
        [item.id]
      );

      for (const img of images) {
        await connection.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [img.path, purchase_item_id, "App\\Models\\PurchaseItem"]
        );
      }
    }

    if (req.files?.attachment) {
      const imageName = `${po.company_id}_${reference_no}_${po.supplier_id}`;
      const images = Array.isArray(req.files.attachment)
        ? req.files.attachment
        : [req.files.attachment];

      for (const file of images) {
        const ext = path.extname(file.name);
        const filename = `purchase_orders/${imageName}_${v4()}${ext}`;
        const { key } = await putObject(file.data, filename);

        await connection.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [`/${key}`, purchase_id, "App\\Models\\PurchaseOrders"]
        );
      }
    }

    await connection.commit();
    return {
      status: "success",
      message: "Purchase received",
      data: { purchase_id },
    };
  } catch (error) {
    await connection.rollback();
    console.error("Receive Error:", error.message);
    return {
      status: "error",
      message: error.message,
      code: 500,
    };
  } finally {
    connection.release();
  }
};

exports.getPurchaseOrderDetail = async (req) => {
  try {
    const purchaseOrderId = req.params.id || req.query.id;
    if (!purchaseOrderId) {
      return {
        status: "Error",
        message: "Missing purchase order ID",
        data: null,
      };
    }

    const [orderRows] = await db.query(
      `
      SELECT po.*, s.name AS supplier_name, s.email AS supplier_email, s.company AS supplier_company, c.name AS company_name
      FROM pre_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN companies c ON c.id = po.company_id
      WHERE po.id = ?
    `,
      [purchaseOrderId]
    );

    const po = orderRows[0];
    if (!po) {
      return {
        status: "Error",
        message: "Purchase order not found",
        data: null,
      };
    }

    const [items] = await db.query(
      `
      SELECT poi.*, poi.pre_order_id, cat.id AS category_id, cat.name AS category_name
      FROM pre_order_items poi
      LEFT JOIN categories cat ON cat.id = poi.category_id
      WHERE poi.pre_order_id = ?
    `,
      [purchaseOrderId]
    );

    const itemIds = items.map((i) => i.id);

    const [poImages] = await db.query(
      `SELECT path FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseOrder' AND imageable_id = ?`,
      [purchaseOrderId]
    );

    const [itemImages] = itemIds.length
      ? await db.query(
          `SELECT imageable_id, path FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseOrderItem' AND imageable_id IN (?)`,
          [itemIds]
        )
      : [[]];

    const itemImageMap = itemImages.reduce((map, img) => {
      if (!map[img.imageable_id]) map[img.imageable_id] = [];
      map[img.imageable_id].push(img.path);
      return map;
    }, {});

    const [received] = await db.query(
      `
      SELECT SUM(total_amount) AS received_amount
      FROM purchase_orders
      WHERE purchase_order_id = ?
    `,
      [purchaseOrderId]
    );

    const [itemReceivedQuantities] = itemIds.length
      ? await db.query(
          `
          SELECT purchase_order_item_id, SUM(quantity) AS received_quantity
          FROM purchase_order_items
          WHERE purchase_order_item_id IN (?)
          GROUP BY purchase_order_item_id
        `,
          [itemIds]
        )
      : [[]];

    const itemReceivedMap = itemReceivedQuantities.reduce((map, row) => {
      map[row.purchase_order_item_id] = row.received_quantity;
      return map;
    }, {});

    const enrichedOrder = {
      ...po,
      attachments: poImages.map((img) => img.path),
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
      received_amount: received[0]?.received_amount || "0",
      orders: items.map((item) => ({
        ...item,
        category: {
          id: item.category_id,
          name: item.category_name,
        },
        images: itemImageMap[item.id] || [],
        received_quantity: itemReceivedMap[item.id] || "0",
      })),
    };

    return {
      status: "Success",
      message: null,
      data: enrichedOrder,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch purchase order details",
      data: null,
    };
  }
};

exports.searchReceivedOrders = async (req) => {
  try {
    const values = [];
    const filterConditions = [];

    if (req.query.supplier_id) {
      filterConditions.push("p.supplier_id = ?");
      values.push(req.query.supplier_id);
    }

    if (req.query.company_id) {
      filterConditions.push("p.company_id = ?");
      values.push(req.query.company_id);
    }

    if (req.user?.role !== "admin") {
      filterConditions.push("p.store_id = ?");
      values.push(req.user.first_store_id);
    }

    if (req.query.keyword) {
      const keyword = `%${req.query.keyword}%`;
      filterConditions.push(
        `(p.reference_no LIKE ? OR p.total_amount LIKE ? 
          OR EXISTS (SELECT 1 FROM suppliers s WHERE s.id = p.supplier_id AND (s.company LIKE ? OR s.name LIKE ?)) 
          OR EXISTS (SELECT 1 FROM pre_orders po WHERE po.id = p.purchase_order_id AND po.reference_no LIKE ?))`
      );
      values.push(keyword, keyword, keyword, keyword, keyword);
    }

    if (req.query.startDate && req.query.endDate) {
      if (req.query.startDate === req.query.endDate) {
        filterConditions.push("DATE(p.purchased_at) = ?");
        values.push(req.query.startDate);
      } else {
        filterConditions.push("DATE(p.purchased_at) BETWEEN ? AND ?");
        values.push(req.query.startDate, req.query.endDate);
      }
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const perPage = parseInt(req.query.per_page) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM purchase_orders p
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const purchaseQuery = `
      SELECT p.*, s.name AS supplier_name, s.company AS supplier_company, s.email AS supplier_email, c.name AS company_name, po.reference_no AS po_reference_no,
             u.id AS user_id, u.username, u.first_name, u.last_name, u.phone_number, u.role, u.email, u.company_id AS user_company_id,
             st.id AS store_id, st.name AS store_name, st.company_id AS store_company_id,
             com_u.name AS user_company_name, com_st.name AS store_company_name
      FROM purchase_orders p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN companies c ON c.id = p.company_id
      LEFT JOIN pre_orders po ON po.id = p.purchase_order_id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN companies com_u ON com_u.id = u.company_id
      LEFT JOIN stores st ON st.id = p.store_id
      LEFT JOIN companies com_st ON com_st.id = st.company_id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const purchaseValues = [...values, perPage, offset];
    const [purchaseRows] = await db.query(purchaseQuery, purchaseValues);

    const purchaseIds = purchaseRows.map((p) => p.id);

    let items = [];
    let itemImages = [];
    if (purchaseIds.length > 0) {
      [items] = await db.query(
        `SELECT pi.*, cat.id AS category_id, cat.name AS category_name
         FROM purchase_order_items pi
         LEFT JOIN categories cat ON cat.id = pi.category_id
         WHERE pi.purchase_id IN (?)`,
        [purchaseIds]
      );

      [itemImages] = await db.query(
        `SELECT imageable_id, path FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseItem' AND imageable_id IN (?)`,
        [items.map((i) => i.id)]
      );
    }

    const imageMap = itemImages.reduce((acc, img) => {
      if (!acc[img.imageable_id]) acc[img.imageable_id] = [];
      acc[img.imageable_id].push(img.path);
      return acc;
    }, {});

    const itemsByPurchase = items.reduce((acc, item) => {
      if (!acc[item.purchase_id]) acc[item.purchase_id] = [];
      acc[item.purchase_id].push({
        ...item,
        category: {
          id: item.category_id,
          name: item.category_name,
        },
        images: imageMap[item.id] || [],
      });
      return acc;
    }, {});

    let purchaseImages = [];
    if (purchaseIds.length > 0) {
      [purchaseImages] = await db.query(
        `SELECT imageable_id, path FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseOrders' AND imageable_id IN (?)`,
        [purchaseIds]
      );
    }

    const purchaseImagesMap = purchaseImages.reduce((acc, img) => {
      if (!acc[img.imageable_id]) acc[img.imageable_id] = [];
      acc[img.imageable_id].push(img.path);
      return acc;
    }, {});

    const enriched = purchaseRows.map((row) => ({
      ...row,
      supplier: {
        id: row.supplier_id,
        name: row.supplier_name,
        email: row.supplier_email,
        company_id: row.company_id,
        company_name: row.supplier_company,
        company: {
          id: row.company_id,
          name: row.supplier_company,
        },
      },
      user: {
        id: row.user_id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        phone_number: row.phone_number,
        email: row.email,
        role: row.role,
        name: `${row.first_name} ${row.last_name}`,
        store_id: row.store_id,
        company: {
          id: row.user_company_id,
          name: row.user_company_name,
        },
      },
      store: {
        id: row.store_id,
        name: row.store_name,
        company: {
          id: row.store_company_id,
          name: row.store_company_name,
        },
      },
      items: itemsByPurchase[row.id] || [],
      images: purchaseImagesMap[row.id] || [],
    }));

    return {
      status: "Success",
      data: {
        current_page: page,
        data: enriched,
        first_page_url: `?page=1&per_page=${perPage}`,
        from: offset + 1,
        last_page: Math.ceil(total / perPage),
        last_page_url: `?page=${Math.ceil(
          total / perPage
        )}&per_page=${perPage}`,
        next_page_url:
          page < Math.ceil(total / perPage)
            ? `?page=${page + 1}&per_page=${perPage}`
            : null,
        path: req.query.base_url || "/api/purchase/search",
        per_page: perPage,
        prev_page_url:
          page > 1 ? `?page=${page - 1}&per_page=${perPage}` : null,
        to: Math.min(offset + perPage, total),
        total,
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

exports.getReceivedOrderDetail = async (req) => {
  try {
    const id = req.params.id;
    if (!id) {
      return {
        status: "Error",
        message: "Missing purchase order ID",
        data: null,
      };
    }

    const [rows] = await db.query(
      `SELECT p.*, s.name AS supplier_name, s.company AS supplier_company, s.email AS supplier_email, c.name AS company_name, po.reference_no AS po_reference_no,
              u.id AS user_id, u.username, u.first_name, u.last_name, u.phone_number, u.role, u.email, u.company_id AS user_company_id,
              st.id AS store_id, st.name AS store_name, st.company_id AS store_company_id,
              com_u.name AS user_company_name, com_st.name AS store_company_name
       FROM purchase_orders p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN companies c ON c.id = p.company_id
       LEFT JOIN pre_orders po ON po.id = p.purchase_order_id
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN companies com_u ON com_u.id = u.company_id
       LEFT JOIN stores st ON st.id = p.store_id
       LEFT JOIN companies com_st ON com_st.id = st.company_id
       WHERE p.id = ?
       LIMIT 1`,
      [id]
    );

    const order = rows[0];
    if (!order) {
      return {
        status: "Error",
        message: "Purchase order not found",
        data: null,
      };
    }

    const [items] = await db.query(
      `SELECT pi.*, cat.id AS category_id, cat.name AS category_name
       FROM purchase_order_items pi
       LEFT JOIN categories cat ON cat.id = pi.category_id
       WHERE pi.purchase_id = ?`,
      [id]
    );

    const [itemImages] = await db.query(
      `SELECT imageable_id, path FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseItem' AND imageable_id IN (?)`,
      [items.map((i) => i.id)]
    );
    const imageMap = itemImages.reduce((acc, img) => {
      if (!acc[img.imageable_id]) acc[img.imageable_id] = [];
      acc[img.imageable_id].push(img.path);
      return acc;
    }, {});

    const enrichedItems = items.map((item) => ({
      ...item,
      category: {
        id: item.category_id,
        name: item.category_name,
      },
      images: imageMap[item.id] || [],
    }));

    const [purchaseImages] = await db.query(
      `SELECT imageable_id, path FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseOrders' AND imageable_id = ?`,
      [id]
    );

    const enriched = {
      ...order,
      supplier: {
        id: order.supplier_id,
        name: order.supplier_name,
        email: order.supplier_email,
        company_id: order.company_id,
        company_name: order.supplier_company,
        company: {
          id: order.company_id,
          name: order.supplier_company,
        },
      },
      user: {
        id: order.user_id,
        username: order.username,
        first_name: order.first_name,
        last_name: order.last_name,
        phone_number: order.phone_number,
        email: order.email,
        role: order.role,
        name: `${order.first_name} ${order.last_name}`,
        store_id: order.store_id,
        company: {
          id: order.user_company_id,
          name: order.user_company_name,
        },
      },
      store: {
        id: order.store_id,
        name: order.store_name,
        company: {
          id: order.store_company_id,
          name: order.store_company_name,
        },
      },
      items: enrichedItems,
      images: purchaseImages.map((img) => img.path),
    };

    return {
      status: "Success",
      data: enriched,
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch purchase order detail",
      data: null,
    };
  }
};

exports.updateReceivedOrder = async (req) => {
  const connection = await db.getConnection();
  try {
    const {
      id,
      reference_no,
      store,
      note,
      shipping_carrier,
      total_amount,
      imageEditable,
    } = req.body;

    if (!reference_no || !store) {
      throw new Error("Missing required fields");
    }

    const [existing] = await connection.query(
      `SELECT purchase_order_id, supplier_id FROM purchase_orders WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing.length) {
      throw new Error("Invalid purchase order ID");
    }

    const { purchase_order_id, supplier_id } = existing[0];

    const [dupRef] = await connection.query(
      `SELECT id FROM purchase_orders WHERE reference_no = ? AND supplier_id = ? AND id != ? LIMIT 1`,
      [reference_no, supplier_id, id]
    );
    if (dupRef.length > 0) {
      return {
        status: "error",
        message: "Reference number already taken",
        code: 422,
        errors: { reference_no: ["Reference number already taken"] },
      };
    }

    await connection.beginTransaction();

    await connection.query(
      `UPDATE purchase_orders SET store_id = ?, reference_no = ?, shipping_carrier = ?, total_amount = ?, note = ?, updated_at = NOW() WHERE id = ?`,
      [store, reference_no, shipping_carrier, total_amount, note, id]
    );

    await connection.query(
      `DELETE FROM purchase_order_items WHERE purchase_id = ?`,
      [id]
    );

    await connection.query(
      `DELETE FROM images WHERE imageable_type = 'App\\Models\\PurchaseItem' AND imageable_id IN (SELECT id FROM purchase_order_items WHERE purchase_id = ?)`,
      [id]
    );

    const items = JSON.parse(req.body.items_json || "[]");

    for (const item of items) {
      const [poi] = await connection.query(
        `SELECT category_id FROM pre_order_items WHERE id = ? LIMIT 1`,
        [item.id]
      );
      const category_id = poi[0]?.category_id;

      const _cost = Number(item.product_cost) || 0;
      const _qty = Number(item.receive) || 0;

      let discountValue = 0;
      if (
        typeof item.discount === "string" &&
        item.discount.trim().endsWith("%")
      ) {
        const percent = Number(item.discount.trim().replace("%", ""));
        if (!isNaN(percent)) discountValue = (_cost * percent) / 100;
      } else {
        const flat = Number(item.discount);
        if (!isNaN(flat)) discountValue = flat;
      }

      const amount = (_cost - discountValue).toFixed() * _qty;

      const [insertItem] = await connection.query(
        `INSERT INTO purchase_order_items (purchase_order_item_id, purchase_id, product, cost, quantity, amount, category_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          item.id,
          id,
          item.product_name,
          item.product_cost,
          item.receive,
          amount,
          category_id,
        ]
      );

      const purchase_item_id = insertItem.insertId;

      const [images] = await connection.query(
        `SELECT path FROM images WHERE imageable_type = 'App\\Models\\PurchaseOrderItem' AND imageable_id = ?`,
        [item.id]
      );

      for (const img of images) {
        await connection.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [img.path, purchase_item_id, "App\\Models\\PurchaseItem"]
        );
      }
    }

    if (imageEditable === "true") {
      if (req.files?.attachment) {
        await connection.query(
          `DELETE FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseOrders' AND imageable_id = ?`,
          [id]
        );

        const imageName = `${supplier_id}_${reference_no}_${id}`;
        const images = Array.isArray(req.files.attachment)
          ? req.files.attachment
          : [req.files.attachment];

        for (const file of images) {
          const ext = path.extname(file.name);
          const filename = `purchase_orders/${imageName}_${v4()}${ext}`;
          const { key } = await putObject(file.data, filename);

          await connection.query(
            `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
             VALUES (?, ?, ?, NOW(), NOW())`,
            [`/${key}`, id, "App\\Models\\PurchaseOrders"]
          );
        }
      } else {
        await connection.query(
          `DELETE FROM images WHERE imageable_type = 'App\\\\Models\\\\PurchaseOrders' AND imageable_id = ?`,
          [id]
        );
      }
    }

    await connection.commit();
    return {
      status: "success",
      message: "Purchase order updated",
      data: { purchase_id: id },
    };
  } catch (error) {
    await connection.rollback();
    console.error("Update Error:", error.message);
    return {
      status: "error",
      message: error.message,
      code: 500,
    };
  } finally {
    connection.release();
  }
};

exports.deleteReceivedOrder = async (req) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    if (!id) throw new Error("Missing purchase ID");

    const [userCheck] = await connection.query(
      `SELECT role FROM users WHERE id = ?`,
      [req.user?.id]
    );
    if (userCheck[0]?.role === "secretary") {
      return {
        status: "error",
        message: "Not allowed",
        code: 403,
      };
    }

    await connection.beginTransaction();

    const [purchaseRow] = await connection.query(
      `SELECT id FROM purchase_orders WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!purchaseRow.length) {
      return {
        status: "error",
        message: "Purchase not found",
        code: 404,
      };
    }

    const [purchaseImages] = await connection.query(
      `SELECT id, path FROM images WHERE imageable_type = 'App\\Models\\PurchaseOrders' AND imageable_id = ?`,
      [id]
    );

    for (const img of purchaseImages) {
      if (await fileExists(img.path)) {
        await deleteFile(img.path);
      }
    }
    await connection.query(
      `DELETE FROM images WHERE imageable_type = 'App\\Models\\PurchaseOrders' AND imageable_id = ?`,
      [id]
    );

    const [purchaseItems] = await connection.query(
      `SELECT id FROM purchase_order_items WHERE purchase_id = ?`,
      [id]
    );
    const purchaseItemIds = purchaseItems.map((i) => i.id);

    if (purchaseItemIds.length) {
      const [itemImages] = await connection.query(
        `SELECT id, path FROM images WHERE imageable_type = 'App\\Models\\PurchaseItem' AND imageable_id IN (?)`,
        [purchaseItemIds]
      );

      for (const img of itemImages) {
        if (await fileExists(img.path)) {
          await deleteFile(img.path);
        }
      }

      await connection.query(
        `DELETE FROM images WHERE imageable_type = 'App\\Models\\PurchaseItem' AND imageable_id IN (?)`,
        [purchaseItemIds]
      );
    }

    await connection.query(
      `DELETE FROM purchase_order_items WHERE purchase_id = ?`,
      [id]
    );
    await connection.query(`DELETE FROM purchase_orders WHERE id = ?`, [id]);

    await connection.commit();
    return {
      status: "success",
      message: "Purchase deleted",
    };
  } catch (error) {
    await connection.rollback();
    console.error("Delete Purchase Error:", error.message);
    return {
      status: "error",
      message: error.message,
      code: 500,
    };
  } finally {
    connection.release();
  }
};
