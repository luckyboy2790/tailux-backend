const db = require("../config/db");
const bcrypt = require("bcryptjs");

exports.enableSiteStatus = async (req) => {
  try {
    const { username, password } = req.body;

    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

    const user = rows[0];

    const passwordMatch =
      user && (await bcrypt.compare(password, user.password));

    if (!passwordMatch) {
      const err = new Error("Invalid credentials");
      err.statusCode = 401;
      throw err;
    }

    const [updateResult] = await db.query(
      "UPDATE settings SET value = ? WHERE `key` = ?",
      ["active", "site_status"]
    );

    if (updateResult.affectedRows === 0) {
      await db.query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", [
        "site_status",
        "active",
      ]);
    }

    return {
      status: "Success",
      data: "active",
      message: "Site status enabled",
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

exports.disableSiteStatus = async (req) => {
  try {
    const user = req.user;

    if (!user || user.role !== "admin") {
      return {
        status: "Error",
        data: null,
        message: "You are not admin", // Replace with localization if available
      };
    }

    // Check if 'site_status' exists
    const [existing] = await db.query(
      "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
      ["site_status"]
    );

    if (existing.length > 0) {
      // Update if exists
      await db.query("UPDATE settings SET `value` = ? WHERE `key` = ?", [
        "disabled",
        "site_status",
      ]);
    } else {
      // Insert if not exists
      await db.query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", [
        "site_status",
        "disabled",
      ]);
    }

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

exports.getSiteStatus = async () => {
  try {
    const [rows] = await db.query(
      "SELECT value FROM settings WHERE `key` = ? LIMIT 1",
      ["site_status"]
    );

    const status = rows.length > 0 ? rows[0].value : null;

    return {
      status: "Success",
      data: status,
      message: "Site status retrieved",
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      data: null,
      message: "Failed to retrieve site status",
    };
  }
};

exports.getDisableTime = async () => {
  try {
    const [rows] = await db.query(
      "SELECT value FROM settings WHERE `key` = ? LIMIT 1",
      ["site_disable_time"]
    );

    const disableTime = rows.length > 0 ? rows[0].value : null;

    return {
      status: "Success",
      data: disableTime,
      message: "Site disable time retrieved",
    };
  } catch (error) {
    console.error(error);
    return {
      status: "Error",
      data: null,
      message: "Failed to retrieve disable time",
    };
  }
};
