const db = require("../config/db");
const bcrypt = require("bcrypt");

exports.enableSiteStatus = async (req) => {
  try {
    const { username, password } = req.body;

    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

    if (!rows || rows.length === 0) {
      return {
        status: "Error",
        data: null,
        message: "Invalid credentials",
      };
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return {
        status: "Error",
        data: null,
        message: "Invalid credentials",
      };
    }

    await db.query(
      "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
      ["site_status", "active", "active"]
    );

    return {
      status: "Success",
      data: "active",
      message: "Site status enabled",
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      data: null,
      message: "Failed to enable site",
    };
  }
};

exports.disableSiteStatus = async (req) => {
  try {
    const user = req.user;
    if (!user || user.role !== "admin") {
      return {
        status: "Error",
        data: null,
        message: "You are not admin",
      };
    }

    await db.query(
      "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
      ["site_status", "disabled", "disabled"]
    );

    return {
      status: "Success",
      data: "disabled",
      message: "Site status disabled",
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      data: null,
      message: "Failed to disable site",
    };
  }
};

exports.setSetting = async (req) => {
  try {
    const config = {};

    const { key, value } = req.body;

    // Read existing entry
    const [rows] = await db.query("SELECT * FROM settings WHERE `key` = ?", [
      key,
    ]);

    // Store raw value
    const valueToStore =
      typeof value === "object" ? JSON.stringify(value) : value;

    if (rows.length > 0) {
      await db.query("UPDATE settings SET `value` = ? WHERE `key` = ?", [
        valueToStore,
        key,
      ]);
    } else {
      await db.query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", [
        key,
        valueToStore,
      ]);
    }

    // mimic Laravel's Config::set and check
    config[key] = value;
    const configSetOk = config[key] === value;

    return {
      status: configSetOk ? "Success" : "Error",
      data: value,
      message: configSetOk ? "Setting saved" : "Setting not saved in config",
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      data: null,
      message: "Failed to set setting",
    };
  }
};

exports.getSetting = async (key) => {
  try {
    const [rows] = await db.query(
      "SELECT value FROM settings WHERE `key` = ?",
      [key]
    );

    if (!rows || rows.length === 0) {
      return {
        status: "Success",
        data: null,
        message: null,
      };
    }

    let value = rows[0].value;
    try {
      value = JSON.parse(value);
    } catch (e) {}

    return {
      status: "Success",
      data: value,
      message: null,
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      data: null,
      message: "Failed to fetch setting",
    };
  }
};
