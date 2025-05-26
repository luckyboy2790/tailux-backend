const db = require("../config/db");
const path = require("path");
const { v4 } = require("uuid");
const slugify = require("slugify");
const moment = require("moment");
const { putObject } = require("../utils/putObject");

exports.search = async (req) => {
  try {
    const { keyword = "", per_page, page = 1 } = req.query;
    const offset = per_page ? (page - 1) * per_page : 0;

    let query = `
      SELECT
        p.id, p.name, p.code, p.unit, p.cost, p.price, p.alert_quantity,
        p.created_at, p.updated_at,
        (SELECT 
          COALESCE(SUM(CASE WHEN o.orderable_type = 'App\\\\Models\\\\Purchase' THEN o.quantity ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN o.orderable_type = 'App\\\\Models\\\\Sale' THEN o.quantity ELSE 0 END), 0)
         FROM orders o WHERE o.product_id = p.id) AS quantity,
        i.id as image_id,
        i.path as image_path,
        i.copied as image_copied,
        i.created_at as image_created_at,
        i.updated_at as image_updated_at
      FROM products p
      LEFT JOIN images i ON i.imageable_id = p.id AND i.imageable_type = 'App\\\\Models\\\\Product'
    `;

    if (keyword) {
      query += ` WHERE p.name LIKE ? OR p.code LIKE ?`;
    }

    query += ` ORDER BY p.created_at DESC`;

    if (per_page) {
      query += ` LIMIT ? OFFSET ?`;
    }

    const queryParams = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
    if (per_page) {
      queryParams.push(parseInt(per_page), offset);
    }

    const [products] = await db.query(query, queryParams);

    const resultsMap = new Map();
    products.forEach((product) => {
      if (!resultsMap.has(product.id)) {
        const productData = {
          id: product.id,
          name: product.name,
          code: product.code,
          unit: product.unit,
          cost: product.cost,
          price: product.price,
          alert_quantity: product.alert_quantity,
          created_at: product.created_at,
          updated_at: product.updated_at,
          quantity: product.quantity,
          images: [],
        };
        resultsMap.set(product.id, productData);
      }

      if (product.image_id) {
        resultsMap.get(product.id).images.push({
          id: product.image_id,
          path: product.image_path,
          imageable_id: product.id,
          imageable_type: "App\\Models\\Product",
          copied: product.image_copied,
          created_at: product.image_created_at,
          updated_at: product.image_updated_at,
          type: "image",
          src: product.image_path || null,
        });
      }
    });

    const results = Array.from(resultsMap.values());

    if (per_page) {
      let countQuery = `SELECT COUNT(*) as total FROM products p`;
      const countParams = [];

      if (keyword) {
        countQuery += ` WHERE p.name LIKE ? OR p.code LIKE ?`;
        countParams.push(`%${keyword}%`, `%${keyword}%`);
      }

      const [[{ total }]] = await db.query(countQuery, countParams);
      const totalPages = Math.ceil(total / per_page);

      const generateUrl = (pageNum) =>
        `${req.protocol}://${req.get("host")}${req.baseUrl}?page=${pageNum}`;

      return {
        status: "Success",
        data: {
          current_page: parseInt(page),
          data: results,
          first_page_url: generateUrl(1),
          from: offset + 1,
          last_page: totalPages,
          last_page_url: generateUrl(totalPages),
          links: [
            {
              url: page > 1 ? generateUrl(page - 1) : null,
              label: "&laquo; Previous",
              active: false,
            },
            {
              url: generateUrl(page),
              label: page,
              active: true,
            },
            {
              url: page < totalPages ? generateUrl(page + 1) : null,
              label: "Next &raquo;",
              active: false,
            },
          ],
          next_page_url: page < totalPages ? generateUrl(page + 1) : null,
          path: `${req.protocol}://${req.get("host")}${req.baseUrl}`,
          per_page: parseInt(per_page),
          prev_page_url: page > 1 ? generateUrl(page - 1) : null,
          to: Math.min(offset + parseInt(per_page), total),
          total: parseInt(total),
        },
        message: null,
      };
    }

    return {
      status: "Success",
      data: results,
      message: null,
    };
  } catch (error) {
    console.error("Error in product search:", error);
    throw error;
  }
};

exports.getProducts = async (req) => {
  try {
    const query = `
      SELECT
        p.id, p.name, p.code, p.barcode_symbology_id, p.category_id,
        p.unit, p.cost, p.price, p.tax_id, p.tax_method,
        p.alert_quantity, p.supplier_id, p.image, p.detail,
        p.created_at, p.updated_at,
        (
          SELECT COALESCE(SUM(quantity), 0)
          FROM orders o
          WHERE o.product_id = p.id AND o.orderable_type = 'App\\Models\\Purchase'
        ) - (
          SELECT COALESCE(SUM(quantity), 0)
          FROM orders o
          WHERE o.product_id = p.id AND o.orderable_type = 'App\\Models\\Sale'
        ) AS quantity,
        i.id as image_id,
        i.path as image_path,
        i.copied as image_copied,
        i.created_at as image_created_at,
        i.updated_at as image_updated_at
      FROM products p
      LEFT JOIN images i ON i.imageable_id = p.id AND i.imageable_type = 'App\\Models\\Product'
      ORDER BY p.created_at DESC
    `;

    const [products] = await db.query(query);

    const resultsMap = new Map();

    products.forEach((product) => {
      if (!resultsMap.has(product.id)) {
        const productData = {
          id: product.id,
          name: product.name,
          code: product.code,
          barcode_symbology_id: product.barcode_symbology_id,
          category_id: product.category_id,
          unit: product.unit,
          cost: product.cost,
          price: product.price,
          tax_id: product.tax_id,
          tax_method: product.tax_method,
          alert_quantity: product.alert_quantity,
          supplier_id: product.supplier_id,
          image: product.image,
          detail: product.detail,
          created_at: product.created_at,
          updated_at: product.updated_at,
          quantity: product.quantity,
          images: [],
        };
        resultsMap.set(product.id, productData);
      }

      if (product.image_id) {
        resultsMap.get(product.id).images.push({
          id: product.image_id,
          path: product.image_path,
          imageable_id: product.id,
          imageable_type: "App\\Models\\Product",
          copied: product.image_copied,
          created_at: product.image_created_at,
          updated_at: product.image_updated_at,
          type: "image",
          src: product.image_path || null,
        });
      }
    });

    return {
      status: "Success",
      data: Array.from(resultsMap.values()),
      message: null,
    };
  } catch (error) {
    console.error("Error in getProducts:", error);
    return {
      status: "Error",
      message: "Failed to fetch products",
      data: null,
    };
  }
};

exports.create = async (req) => {
  try {
    const {
      product_name,
      product_code,
      product_unit,
      product_cost,
      product_price,
      alert_quantity,
    } = req.body;

    if (!product_name || !product_code || !product_unit) {
      throw new Error(
        "Missing required fields: product_name, product_code, product_unit"
      );
    }

    const [exists] = await db.query(`SELECT id FROM products WHERE code = ?`, [
      product_code,
    ]);

    if (exists.length > 0) {
      throw new Error("Product code must be unique");
    }

    const [insertResult] = await db.query(
      `INSERT INTO products (name, code, unit, cost, price, alert_quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        product_name,
        product_code,
        product_unit,
        product_cost || 0,
        product_price || 0,
        alert_quantity || 0,
      ]
    );

    const product_id = insertResult.insertId;

    if (req.files && req.files.attachment) {
      const attachments = Array.isArray(req.files.attachment)
        ? req.files.attachment
        : [req.files.attachment];

      for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        const ext = path.extname(file.name);
        const filename = `${slugify(product_name, {
          lower: true,
        })}_${v4()}${ext}`;

        const { key } = await putObject(file.data, `products/${filename}`);

        await db.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [`/${key}`, product_id, "App\\Models\\Product"]
        );
      }
    }

    return {
      status: "success",
      product_id,
    };
  } catch (error) {
    console.error(error);

    return {
      status: "error",
      message: error.message,
      code:
        error.message.includes("Missing") || error.message.includes("unique")
          ? 422
          : 500,
    };
  }
};

exports.update = async (req) => {
  try {
    const {
      id,
      product_name,
      product_code,
      product_unit,
      product_cost = 0,
      product_price = 0,
      alert_quantity = 0,
    } = req.body;

    if (!id || !product_name || !product_code || !product_unit) {
      throw new Error(
        "Missing required fields: id, product_name, product_code, product_unit"
      );
    }

    const [[product]] = await db.query(`SELECT id FROM products WHERE id = ?`, [
      id,
    ]);
    if (!product) throw new Error("Product not found");

    await db.query(
      `UPDATE products SET name = ?, code = ?, unit = ?, cost = ?, price = ?, alert_quantity = ?, updated_at = NOW() WHERE id = ?`,
      [
        product_name,
        product_code,
        product_unit,
        product_cost,
        product_price,
        alert_quantity,
        id,
      ]
    );

    if (req.files && req.files.attachment) {
      await db.query(
        `DELETE FROM images WHERE imageable_id = ? AND imageable_type = ?`,
        [id, "App\\Models\\Product"]
      );

      const attachments = Array.isArray(req.files.attachment)
        ? req.files.attachment
        : [req.files.attachment];

      const [[productRow]] = await db.query(
        `SELECT name FROM products WHERE id = ?`,
        [id]
      );
      const product_slug = slugify(productRow?.name || "", { lower: true });

      for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        const ext = path.extname(file.name);
        const filename = `${product_slug}_${v4()}${ext}`;

        const { key } = await putObject(file.data, `products/${filename}`);

        await db.query(
          `INSERT INTO images (path, imageable_id, imageable_type, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
          [`/${key}`, id, "App\\Models\\Product"]
        );
      }
    }

    return {
      status: "success",
      product_id: id,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message,
      code: 500,
    };
  }
};

exports.delete = async (req) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new Error("Product ID is required");
    }

    const [[orderExists]] = await db.query(
      `SELECT 1 FROM orders WHERE product_id = ? LIMIT 1`,
      [id]
    );

    const [[preOrderExists]] = await db.query(
      `SELECT 1 FROM pre_order_items WHERE product_id = ? LIMIT 1`,
      [id]
    );

    if (orderExists || preOrderExists) {
      return {
        status: "error",
        message: "Something went wrong",
        code: 400,
      };
    }

    await db.query(`DELETE FROM products WHERE id = ?`, [id]);

    return {
      status: "success",
      message: "Product deleted",
    };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message,
      code: 500,
    };
  }
};
