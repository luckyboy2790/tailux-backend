const jwt = require("jsonwebtoken");
const db = require("../config/db");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const [rows] = await db.query(
        "SELECT * FROM users WHERE id = ? LIMIT 1",
        [decoded.id]
      );

      if (rows.length === 0) {
        return res.status(404).send({ message: "User not found" });
      }

      req.user = rows[0];
      next();
    } else {
      return res
        .status(401)
        .send({ message: "Authorization header missing or malformed" });
    }
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
