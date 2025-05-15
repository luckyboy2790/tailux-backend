const Preturn = require("../models/preturn.model");

exports.createPreturn = async (req, res) => {
  try {
    const preturnId = await Preturn.create(req);

    res.json(preturnId);
  } catch (error) {
    console.error(error);
  }
};

exports.searchPreturn = async (req, res) => {
  try {
    const returns = await Preturn.search(req);

    res.json(returns);
  } catch (error) {
    console.error(error);
  }
};
