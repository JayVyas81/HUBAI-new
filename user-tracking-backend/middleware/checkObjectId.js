const { param } = require("express-validator");
const mongoose = require("mongoose");

const checkObjectId = param("id").custom((value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error("Invalid ID format");
  }
  return true;
});

module.exports = checkObjectId;
