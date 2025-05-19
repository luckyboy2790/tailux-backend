const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");

exports.login = async (req) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new Error("Username and password are required.");
    }

    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) {
      throw new Error("Invalid credentials.");
    }

    const user = rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new Error("Invalid password.");
    }

    const ip_address = req.ip;
    if (
      user.role === "secretary" &&
      user.ip_address &&
      user.ip_address !== ip_address
    ) {
      throw new Error("Login not allowed from this device.");
    }

    await db.query("UPDATE users SET last_ip = ? WHERE id = ?", [
      ip_address,
      user.id,
    ]);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return {
      authToken: token,
      user,
      token_type: "bearer",
      expires_in: 86400,
    };
  } catch (error) {
    console.error("Login error:", error);
    throw new Error(error.message);
  }
};

exports.checkOTP = async (req) => {
  try {
    const { one_time_password, google2fa_secret } = req.body;

    if (!one_time_password || !/^\d{6}$/.test(one_time_password)) {
      throw new Error("The OTP must be exactly 6 digits.");
    }

    if (!google2fa_secret) {
      throw new Error("Missing 2FA secret.");
    }

    const window = 1;

    const isValid = speakeasy.totp.verify({
      secret: google2fa_secret,
      encoding: "base32",
      token: one_time_password,
      window,
    });

    if (!isValid) {
      throw new Error("Wrong OTP.");
    }

    return {
      success: true,
      message: "OTP verified successfully.",
    };
  } catch (error) {
    console.error("OTP check error:", error.message);
    throw new Error(error.message);
  }
};
