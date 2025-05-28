const db = require("../config/db");

exports.findAll = async () => {
  try {
    const [rows] = await db.query("SELECT * FROM companies");
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

exports.searchCompanies = async (req) => {
  try {
    const values = [];
    const filterConditions = [];

    if (req.query.keyword) {
      filterConditions.push("c.name LIKE ?");
      values.push(`%${req.query.keyword}%`);
    }

    const whereClause = filterConditions.length
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const perPage = parseInt(req.query.per_page) || 15;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    // Count total companies
    const countQuery = `SELECT COUNT(*) AS total FROM companies c ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    // Get paginated companies
    const companyQuery = `
      SELECT c.*
      FROM companies c
      ${whereClause}
      ORDER BY c.name ASC
      LIMIT ? OFFSET ?
    `;
    const companyValues = [...values, perPage, offset];
    const [companyRows] = await db.query(companyQuery, companyValues);
    const companyIds = companyRows.map((c) => c.id);

    if (!companyIds.length) {
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

    // Get users for each company
    const [users] = await db.query(
      `
      SELECT
        u.*,
        c.id AS company_id,
        c.name AS company_name
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE u.company_id IN (${companyIds.map(() => "?").join(",")})
      ORDER BY u.username ASC
    `,
      companyIds
    );

    // Get stores for each company
    const [stores] = await db.query(
      `
      SELECT
        s.*,
        c.id AS company_id,
        c.name AS company_name
      FROM stores s
      LEFT JOIN companies c ON c.id = s.company_id
      WHERE s.company_id IN (${companyIds.map(() => "?").join(",")})
      ORDER BY s.name ASC
    `,
      companyIds
    );

    // Group users and stores by company_id
    const groupByCompanyId = (items, key = "company_id") => {
      const map = {};
      for (const item of items) {
        const id = item[key];
        if (!map[id]) map[id] = [];
        map[id].push(item);
      }
      return map;
    };

    const userMap = groupByCompanyId(users);
    const storeMap = groupByCompanyId(stores);

    // Enrich companies with their users and stores
    const enriched = companyRows.map((company) => {
      const companyUsers = (userMap[company.id] || []).map((user) => ({
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        email_verified_at: user.email_verified_at,
        password_updated_at: user.password_updated_at,
        phone_number: user.phone_number,
        role: user.role,
        company_id: user.company_id,
        status: user.status,
        picture: user.picture,
        last_ip: user.last_ip,
        ip_address: user.ip_address,
        unread_messages: user.unread_messages,
        enable_google2fa: user.enable_google2fa,
        google2fa_secret: user.google2fa_secret,
        created_at: user.created_at,
        updated_at: user.updated_at,
        photo_url: `https://www.gravatar.com/avatar/${
          user.email
            ? require("crypto")
                .createHash("md5")
                .update(user.email.trim().toLowerCase())
                .digest("hex")
            : "00000000000000000000000000000000"
        }.jpg?s=200&d=https%3A%2F%2Fui-avatars.com%2Fapi%2F${encodeURIComponent(
          (user.first_name || "") + "+" + (user.last_name || "")
        )}`,
        name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
        first_store_id:
          (storeMap[company.id] && storeMap[company.id][0]?.id) || null,
        company: {
          id: company.id,
          name: company.name,
          created_at: company.created_at,
          updated_at: company.updated_at,
        },
      }));

      const companyStores = (storeMap[company.id] || []).map((store) => ({
        id: store.id,
        name: store.name,
        company_id: store.company_id,
        created_at: store.created_at,
        updated_at: store.updated_at,
        company: {
          id: company.id,
          name: company.name,
          created_at: company.created_at,
          updated_at: company.updated_at,
        },
      }));

      return {
        ...company,
        users: companyUsers,
        stores: companyStores,
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / perPage);
    const baseUrl = `${
      req.query.base_url || "http://your-domain.com/api/company/search"
    }`;

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
      message: "Failed to fetch companies",
      data: null,
    };
  }
};

exports.create = async (req) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      throw new Error("'name' is required and must be a string.");
    }

    const [result] = await db.query(
      `INSERT INTO companies (name, created_at, updated_at)
       VALUES (?, NOW(), NOW())`,
      [name]
    );

    const [company] = await db.query("SELECT * FROM companies WHERE id = ?", [
      result.insertId,
    ]);

    return {
      status: "success",
      data: company[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to create company");
  }
};

exports.update = async (req) => {
  try {
    const { id, name } = req.body;
    if (!id) throw new Error("'id' is required.");
    if (!name) throw new Error("'name' is required.");

    const [existing] = await db.query("SELECT * FROM companies WHERE id = ?", [id]);
    if (!existing.length) {
      throw new Error("Company not found");
    }

    await db.query(
      `UPDATE companies SET name = ?, updated_at = NOW() WHERE id = ?`,
      [name, id]
    );

    const [updated] = await db.query("SELECT * FROM companies WHERE id = ?", [id]);

    return {
      status: "success",
      data: updated[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to update company");
  }
};

exports.delete = async (req) => {
  try {
    const { id } = req.params;
    if (!id) throw new Error("'id' is required");

    await db.query("DELETE FROM companies WHERE id = ?", [id]);

    return {
      status: "success",
      message: "Company deleted successfully.",
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to delete company");
  }
};
