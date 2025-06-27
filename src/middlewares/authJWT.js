const jwt = require("jsonwebtoken");
const db = require("../config/db");
const crypto = require("crypto");

const getGravatarOrAvatarUrl = (username, name, picture) => {
  if (picture) {
    return `${process.env.APP_URL}/storage/${picture}`;
  }

  const hash = crypto
    .createHash("md5")
    .update(username.toLowerCase())
    .digest("hex");
  const fallback = name
    ? encodeURIComponent(`https://ui-avatars.com/api/${name}`)
    : "mp";

  return `https://www.gravatar.com/avatar/${hash}.jpg?s=200&d=${fallback}`;
};

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .send({ message: "Authorization header missing or malformed" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [
      decoded.id,
    ]);
    if (!users.length)
      return res.status(404).send({ message: "User not found" });

    const user = users[0];

    const [companies] = await db.query(
      "SELECT * FROM companies WHERE id = ? LIMIT 1",
      [user.company_id]
    );
    const company = companies[0] || null;

    let first_store_id = 1;
    if (company) {
      const [stores] = await db.query(
        "SELECT id FROM stores WHERE company_id = ? ORDER BY id ASC LIMIT 1",
        [user.company_id]
      );
      first_store_id = stores[0]?.id || 1;
    }

    const fullName =
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.username;

    req.user = {
      ...user,
      name: fullName,
      photo_url: getGravatarOrAvatarUrl(user.username, fullName, user.picture),
      company,
      first_store_id,
    };

    next();
  } catch (err) {
    console.error("Token verification error:", err);

    if (err.name === "TokenExpiredError") {
      return res.status(401).send({ message: "Token expired" });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(401).send({ message: "Invalid token" });
    }

    res.status(500).send({ message: "Internal server error" });
  }
};

module.exports = verifyToken;
