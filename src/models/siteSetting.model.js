const db = require("../config/db");

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
