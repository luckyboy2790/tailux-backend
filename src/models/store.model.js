const db = require("../config/db");

exports.searchStores = async (req) => {
  try {
    const values = [];
    const filterConditions = [];

    if (req.query.keyword && req.query.keyword !== "") {
      filterConditions.push("(s.name LIKE ? OR c.name LIKE ?)");
      const keywordLike = `%${req.query.keyword}%`;
      values.push(keywordLike, keywordLike);
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const perPage = parseInt(req.query.per_page) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    // Count total records
    const countQuery = `SELECT COUNT(*) AS total FROM stores s LEFT JOIN companies c ON c.id = s.company_id ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    // Get paginated data
    const dataQuery = `
      SELECT
        s.*,
        c.id AS company_id,
        c.name AS company_name,
        c.created_at AS company_created_at,
        c.updated_at AS company_updated_at
      FROM stores s
      LEFT JOIN companies c ON c.id = s.company_id
      ${whereClause}
      LIMIT ? OFFSET ?
    `;
    const dataValues = [...values, perPage, offset];
    const [stores] = await db.query(dataQuery, dataValues);

    // Format the response to match Laravel's paginator
    const totalPages = Math.ceil(total / perPage);
    const from = offset + 1;
    const to = Math.min(offset + perPage, total);

    const links = [];
    if (page > 1) {
      links.push({
        url: `${req.query.baseUrl || ""}?page=${
          page - 1
        }&per_page=${perPage}&keyword=${req.query.keyword || ""}`,
        label: "&laquo; Previous",
        active: false,
      });
    } else {
      links.push({
        url: null,
        label: "&laquo; Previous",
        active: false,
      });
    }

    for (let i = 1; i <= totalPages; i++) {
      links.push({
        url: `${
          req.query.baseUrl || ""
        }?page=${i}&per_page=${perPage}&keyword=${req.query.keyword || ""}`,
        label: i.toString(),
        active: i === page,
      });
    }

    if (page < totalPages) {
      links.push({
        url: `${req.query.baseUrl || ""}?page=${
          page + 1
        }&per_page=${perPage}&keyword=${req.query.keyword || ""}`,
        label: "Next &raquo;",
        active: false,
      });
    } else {
      links.push({
        url: null,
        label: "Next &raquo;",
        active: false,
      });
    }

    const response = {
      status: "Success",
      data: {
        current_page: page,
        data: stores.map((store) => ({
          id: store.id,
          name: store.name,
          company_id: store.company_id,
          created_at: store.created_at,
          updated_at: store.updated_at,
          company: {
            id: store.company_id,
            name: store.company_name,
            created_at: store.company_created_at,
            updated_at: store.company_updated_at,
          },
        })),
        first_page_url: `${
          req.query.baseUrl || ""
        }?page=1&per_page=${perPage}&keyword=${req.query.keyword || ""}`,
        from,
        last_page: totalPages,
        last_page_url: `${
          req.query.baseUrl || ""
        }?page=${totalPages}&per_page=${perPage}&keyword=${
          req.query.keyword || ""
        }`,
        links,
        next_page_url:
          page < totalPages
            ? `${req.query.baseUrl || ""}?page=${
                page + 1
              }&per_page=${perPage}&keyword=${req.query.keyword || ""}`
            : null,
        path: req.query.baseUrl || "",
        per_page: perPage,
        prev_page_url:
          page > 1
            ? `${req.query.baseUrl || ""}?page=${
                page - 1
              }&per_page=${perPage}&keyword=${req.query.keyword || ""}`
            : null,
        to,
        total,
      },
      message: null,
    };

    return response;
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch stores",
      data: null,
    };
  }
};

exports.getStores = async (req) => {
  try {
    const query = `
      SELECT
        s.id AS store_id,
        s.name AS store_name,
        s.created_at AS store_created_at,
        s.updated_at AS store_updated_at,
        c.id AS company_id,
        c.name AS company_name,
        c.created_at AS company_created_at,
        c.updated_at AS company_updated_at
      FROM stores s
      LEFT JOIN companies c ON c.id = s.company_id
    `;

    // run query
    const [rows] = await db.query(query);

    // map to JS objects
    const stores = rows.map((r) => ({
      id: r.store_id,
      name: r.store_name,
      created_at: r.store_created_at,
      updated_at: r.store_updated_at,
      company: {
        id: r.company_id,
        name: r.company_name,
        created_at: r.company_created_at,
        updated_at: r.company_updated_at,
      },
    }));

    // mirror your sendResponse shape
    return {
      status: "Success",
      data: stores,
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch stores",
      data: null,
    };
  }
};

// controllers/storeController.js

exports.create = async (req) => {
  try {
    const { name, company } = req.body;

    if (!name || !company) {
      throw new Error("'name' and 'company' are required.");
    }

    const [result] = await db.query(
      "INSERT INTO stores (name, company_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
      [name, company]
    );

    const [store] = await db.query("SELECT * FROM stores WHERE id = ?", [
      result.insertId,
    ]);

    return {
      status: "success",
      data: store[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to create store");
  }
};

exports.update = async (req) => {
  try {
    const { id, name, company } = req.body;

    if (!id || !name || !company) {
      throw new Error("'id', 'name', and 'company' are required.");
    }

    const [existing] = await db.query("SELECT * FROM stores WHERE id = ?", [
      id,
    ]);

    if (existing.length === 0) {
      throw new Error("Store not found.");
    }

    await db.query(
      "UPDATE stores SET name = ?, company_id = ?, updated_at = NOW() WHERE id = ?",
      [name, company, id]
    );

    const [updated] = await db.query("SELECT * FROM stores WHERE id = ?", [id]);

    return {
      status: "success",
      data: updated[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to update store");
  }
};

exports.delete = async (req) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new Error("'id' is required.");
    }

    await db.query("DELETE FROM stores WHERE id = ?", [id]);

    return {
      status: "success",
      message: "Store deleted successfully",
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to delete store");
  }
};
