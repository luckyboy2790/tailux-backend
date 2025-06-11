const db = require("../config/db");
const bcrypt = require("bcrypt");
const path = require("path");
const { v4 } = require("uuid");
const slugify = require("slugify");
const { putObject } = require("../utils/putObject");
const { deletObject } = require("../utils/deleteObject");

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

exports.create = async (req) => {
  try {
    const {
      username,
      first_name,
      last_name,
      phone_number,
      ip_address,
      email,
      role,
      company_id,
      password,
      enable_google2fa,
    } = req.body;

    const errors = [];

    if (!username) errors.push("'username' is required.");
    if (!role) errors.push("'role' is required.");
    if (!phone_number) errors.push("'phone_number' is required.");
    if (!password) errors.push("'password' is required.");
    if (!enable_google2fa) errors.push("'enable_google2fa' is required.");

    if (["user", "secretary"].includes(role) && !company_id) {
      errors.push("'company_id' is required for user/secretary roles.");
    }

    const [exists] = await db.query("SELECT id FROM users WHERE username = ?", [
      username,
    ]);
    if (exists.length > 0) {
      errors.push("Username already exists.");
    }

    const [emailExists] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (emailExists.length > 0) {
      errors.push("Email already exists.");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(" "));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users (username, first_name, last_name, phone_number, ip_address, email, role, company_id, password, enable_google2fa, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        username,
        first_name,
        last_name,
        phone_number,
        ip_address,
        email,
        role,
        company_id,
        hashedPassword,
        enable_google2fa,
      ]
    );

    const [user] = await db.query("SELECT * FROM users WHERE id = ?", [
      result.insertId,
    ]);

    return {
      status: "success",
      data: user[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to create user");
  }
};

exports.update = async (req) => {
  try {
    const {
      id,
      username,
      first_name,
      last_name,
      phone_number,
      ip_address,
      email,
      company_id,
      role,
      password,
      enable_google2fa,
    } = req.body;

    const errors = [];

    if (!id) errors.push("'id' is required.");
    if (!username) errors.push("'username' is required.");
    if (!first_name) errors.push("'first_name' is required.");
    if (!last_name) errors.push("'last_name' is required.");
    if (!phone_number) errors.push("'phone_number' is required.");
    if (!enable_google2fa) errors.push("'enable_google2fa' is required.");

    if (errors.length > 0) {
      throw new Error(errors.join(" "));
    }

    const [userResult] = await db.query("SELECT * FROM users WHERE id = ?", [
      id,
    ]);
    if (!userResult.length) {
      throw new Error("User not found");
    }
    const user = userResult[0];

    const updateFields = [
      "username = ?",
      "first_name = ?",
      "last_name = ?",
      "phone_number = ?",
      "ip_address = ?",
      "email = ?",
      "company_id = ?",
      "role = ?",
      "enable_google2fa = ?",
      "updated_at = NOW()",
    ];
    const updateValues = [
      username,
      first_name,
      last_name,
      phone_number,
      ip_address,
      email,
      company_id,
      role,
      enable_google2fa,
    ];

    if (password && password !== undefined && password !== "undefined") {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        throw new Error("Same password cannot be reused.");
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push("password = ?", "password_updated_at = NOW()");
      updateValues.push(hashedPassword, id);
    }

    updateValues.push(id);

    await db.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );

    const [updated] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

    return {
      status: "success",
      data: updated[0],
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to update user");
  }
};

exports.delete = async (req) => {
  try {
    const { id } = req.params;
    if (!id) throw new Error("User ID is required");

    await db.query("DELETE FROM users WHERE id = ?", [id]);

    return {
      status: "success",
      message: "User deleted successfully.",
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message || "Failed to delete user");
  }
};

exports.updateProfile = async (req) => {
  try {
    const { id } = req.user;
    const { username, first_name, last_name, email, phone } = req.body;

    const errors = [];

    if (!id) errors.push("'id' is required.");
    if (!username) errors.push("'username' is required.");
    if (!first_name) errors.push("'first_name' is required.");
    if (!last_name) errors.push("'last_name' is required.");
    if (!email) errors.push("'email' is required.");

    if (errors.length > 0) throw new Error(errors.join(" "));

    const [existing] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    if (!existing.length) throw new Error("User not found");

    const updateFields = [
      "username = ?",
      "first_name = ?",
      "last_name = ?",
      "email = ?",
      "phone_number = ?",
      "updated_at = NOW()",
    ];
    const updateValues = [username, first_name, last_name, email, phone];

    if (req.files?.avatar) {
      const filename = `${username}.png`;
      await deletObject(`users/${filename}`);
      const avatarFile = req.files.avatar;
      const { key } = await putObject(avatarFile.data, `users/${filename}`);

      console.log(key);
    }

    updateValues.push(id);
    await db.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );

    const [updated] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

    return {
      status: "success",
      data: updated[0],
    };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message || "Failed to update profile",
    };
  }
};

exports.updatePassword = async (req) => {
  try {
    const { id } = req.user;
    const { password } = req.body;

    const errors = [];

    if (!id) errors.push("'id' is required.");
    if (!password) errors.push("'password' is required.");

    if (errors.length > 0) throw new Error(errors.join(" "));

    const [existing] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    if (!existing.length) throw new Error("User not found");

    const hashedPassword = await bcrypt.hash(password, 10);

    const updateFields = ["password = ?", "updated_at = NOW()"];
    const updateValues = [hashedPassword];

    updateValues.push(id);
    await db.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );

    const [updated] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

    return {
      status: "success",
      data: updated[0],
    };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: error.message || "Failed to update password",
    };
  }
};
