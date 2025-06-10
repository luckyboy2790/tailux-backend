const db = require("../config/db");

exports.findAll = async () => {
  try {
    const [rows] = await db.query("SELECT * FROM categories");
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

exports.searchCategories = async (req) => {
  try {
    const values = [];
    const whereClauses = [];

    if (req.query.keyword) {
      whereClauses.push("name LIKE ?");
      values.push(`%${req.query.keyword}%`);
    }

    const where = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";
    const perPage = parseInt(req.query.per_page) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    const countQuery = `SELECT COUNT(*) AS total FROM categories ${where}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / perPage);

    const dataQuery = `SELECT * FROM categories ${where} ORDER BY created_at ASC LIMIT ? OFFSET ?`;
    const [rows] = await db.query(dataQuery, [...values, perPage, offset]);

    if (!rows.length) {
      return {
        status: "Success",
        data: {
          current_page: page,
          data: [],
          first_page_url: null,
          from: 0,
          last_page: totalPages,
          last_page_url: null,
          links: [],
          next_page_url: null,
          path:
            req.query.base_url ||
            "http://your-domain.com/api/categories/search",
          per_page: perPage,
          prev_page_url: null,
          to: 0,
          total,
        },
        message: null,
      };
    }

    const categoryIds = rows.map((r) => r.id);
    const placeholders = categoryIds.map(() => "?").join(",");
    const companyFilter = req.query.company_id ? "AND po.company_id = ?" : "";
    const valueArgs = req.query.company_id
      ? [...categoryIds, req.query.company_id]
      : categoryIds;

    const [ordered] = await db.query(
      `SELECT category_id, SUM(quantity) AS ordered_quantity FROM pre_order_items poi
         JOIN pre_orders po ON po.id = poi.pre_order_id
         WHERE category_id IN (${placeholders}) ${companyFilter}
         GROUP BY category_id`,
      valueArgs
    );

    const [received] = await db.query(
      `SELECT category_id, SUM(quantity) AS received_quantity FROM purchase_order_items pi
         JOIN purchase_orders p ON p.id = pi.purchase_id
         WHERE category_id IN (${placeholders}) ${companyFilter.replace(
        "po",
        "p"
      )}
         GROUP BY category_id`,
      valueArgs
    );

    const orderedMap = {};
    for (const row of ordered) {
      orderedMap[row.category_id] = row.ordered_quantity;
    }

    const receivedMap = {};
    for (const row of received) {
      receivedMap[row.category_id] = row.received_quantity;
    }

    const enriched = rows.map((cat) => ({
      ...cat,
      ordered_quantity: orderedMap[cat.id] || 0,
      received_quantity: receivedMap[cat.id] || 0,
    }));

    const baseUrl =
      req.query.base_url || "http://your-domain.com/api/categories/search";
    const links = [];

    if (page > 1) {
      links.push({
        url: `${baseUrl}?page=${page - 1}&per_page=${perPage}${
          req.query.keyword
            ? `&keyword=${encodeURIComponent(req.query.keyword)}`
            : ""
        }`,
        label: "&laquo; Previous",
        active: false,
      });
    }

    for (let i = 1; i <= totalPages; i++) {
      links.push({
        url: `${baseUrl}?page=${i}&per_page=${perPage}${
          req.query.keyword
            ? `&keyword=${encodeURIComponent(req.query.keyword)}`
            : ""
        }`,
        label: i.toString(),
        active: i === page,
      });
    }

    if (page < totalPages) {
      links.push({
        url: `${baseUrl}?page=${page + 1}&per_page=${perPage}${
          req.query.keyword
            ? `&keyword=${encodeURIComponent(req.query.keyword)}`
            : ""
        }`,
        label: "Next &raquo;",
        active: false,
      });
    }

    return {
      status: "Success",
      data: {
        current_page: page,
        data: enriched,
        first_page_url: `${baseUrl}?page=1&per_page=${perPage}${
          req.query.keyword
            ? `&keyword=${encodeURIComponent(req.query.keyword)}`
            : ""
        }`,
        from: offset + 1,
        last_page: totalPages,
        last_page_url: `${baseUrl}?page=${totalPages}&per_page=${perPage}${
          req.query.keyword
            ? `&keyword=${encodeURIComponent(req.query.keyword)}`
            : ""
        }`,
        links,
        next_page_url:
          page < totalPages
            ? `${baseUrl}?page=${page + 1}&per_page=${perPage}${
                req.query.keyword
                  ? `&keyword=${encodeURIComponent(req.query.keyword)}`
                  : ""
              }`
            : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url:
          page > 1
            ? `${baseUrl}?page=${page - 1}&per_page=${perPage}${
                req.query.keyword
                  ? `&keyword=${encodeURIComponent(req.query.keyword)}`
                  : ""
              }`
            : null,
        to: Math.min(offset + perPage, total),
        total,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch categories",
      data: null,
    };
  }
};

exports.saveCategory = async (req) => {
  try {
    const { id, name } = req.body;
    if (!name || typeof name !== "string") {
      throw new Error("'name' is required and must be a string.");
    }

    if (id) {
      await db.query(
        `UPDATE categories SET name = ?, updated_at = NOW() WHERE id = ?`,
        [name, id]
      );
    } else {
      const [result] = await db.query(
        `INSERT INTO categories (name, created_at, updated_at)
           VALUES (?, NOW(), NOW())`,
        [name]
      );
      req.body.id = result.insertId;
    }

    const [category] = await db.query("SELECT * FROM categories WHERE id = ?", [
      req.body.id,
    ]);

    return {
      status: "success",
      data: category[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to save category");
  }
};

exports.deleteCategory = async (req) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM categories WHERE id = ?", [id]);
    return {
      status: "success",
      message: "Category deleted",
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to delete category");
  }
};
