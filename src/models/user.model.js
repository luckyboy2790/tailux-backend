const db = require("../config/db");

exports.findAll = async () => {
  const [rows] = await db.query("SELECT * FROM users");
  return rows;
};

exports.searchUsers = async (req) => {
  try {
    const values = [];
    const filterConditions = ["u.status = 1"];

    if (req.query.company_id) {
      filterConditions.push("u.company_id = ?");
      values.push(req.query.company_id);
    }

    if (req.query.keyword) {
      filterConditions.push(`(
        u.username LIKE ?
        OR u.first_name LIKE ?
        OR u.last_name LIKE ?
        OR u.phone_number LIKE ?
        OR u.company_id IN (SELECT id FROM companies WHERE name LIKE ?)
      )`);
      const keywordLike = `%${req.query.keyword}%`;
      values.push(
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

    const countQuery = `SELECT COUNT(*) AS total FROM users u ${whereClause}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0]?.total || 0;

    const userQuery = `
      SELECT
        u.*,
        c.id AS company_id,
        c.name AS company_name,
        c.created_at AS company_created_at,
        c.updated_at AS company_updated_at,
        (SELECT id FROM stores WHERE company_id = u.company_id LIMIT 1) AS first_store_id
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const userValues = [...values, perPage, offset];
    const [userRows] = await db.query(userQuery, userValues);

    const enriched = userRows.map((row) => {
      const nameParts = [];
      if (row.first_name) nameParts.push(row.first_name);
      if (row.last_name) nameParts.push(row.last_name);
      const name = nameParts.length ? nameParts.join(" ") : row.username;

      let photoUrl;
      if (row.picture) {
        photoUrl = `http://your-domain.com/storage/${row.picture}`;
      } else {
        const emailHash = row.email
          ? require("crypto")
              .createHash("md5")
              .update(row.email.toLowerCase())
              .digest("hex")
          : "00000000000000000000000000000000";
        const nameParam = name ? encodeURIComponent(name) : "mp";
        photoUrl = `https://www.gravatar.com/avatar/${emailHash}.jpg?s=200&d=https://ui-avatars.com/api/${nameParam}`;
      }

      return {
        ...row,
        photo_url: photoUrl,
        name: name,
        first_store_id: row.first_store_id || 1,
        company: row.company_id
          ? {
              id: row.company_id,
              name: row.company_name,
              created_at: row.company_created_at,
              updated_at: row.company_updated_at,
            }
          : null,
      };
    });

    const totalPages = Math.ceil(total / perPage);
    const baseUrl = `http://your-domain.com/api/user/search`;

    return {
      status: "Success",
      data: {
        current_page: page,
        data: enriched,
        first_page_url: `${baseUrl}?page=1`,
        from: (page - 1) * perPage + 1,
        last_page: totalPages,
        last_page_url: `${baseUrl}?page=${totalPages}`,
        links: [
          {
            url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
            label: "&laquo; Anterior",
            active: false,
          },
          {
            url: `${baseUrl}?page=${page}`,
            label: page.toString(),
            active: true,
          },
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
        to: Math.min(page * perPage, total),
        total: total,
      },
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch users",
      data: null,
    };
  }
};

exports.getUserById = async (req) => {
  try {
    const userId = req.params.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [
      userId,
    ]);

    if (rows.length === 0) {
      return {
        status: "Error",
        message: "User not found",
        data: null,
      };
    }
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      message: "Failed to fetch user",
      data: null,
    };
  }
};
