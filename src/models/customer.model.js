const db = require("../config/db");

exports.findAll = async () => {
  try {
    const [rows] = await db.query("SELECT * FROM customers");
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
