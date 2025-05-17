const Preturn = require("../models/preturn.model");

exports.createPreturn = async (req, res) => {
  try {
    const preturnId = await Preturn.create(req);

    res.json(preturnId);
  } catch (error) {
    console.error(error);
  }
};

exports.updatePreturn = async (req, res) => {
  try {
    const preturnId = await Preturn.update(req);

    res.json(preturnId);
  } catch (error) {
    console.error(error);
  }
};

exports.deletePreturn = async (req, res) => {
  try {
    const preturnId = await Preturn.delete(req);

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

exports.approvePreturn = async (req, res) => {
  try {
    const preturnId = await Preturn.approve(req);

    res.json(preturnId);
  } catch (error) {
    console.error(error);
  }
};
