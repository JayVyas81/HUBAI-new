const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema({
  userId: String,
  url: String,
  title: String,
  openTime: Date,
  closeTime: Date,
  timeSpent: Number,
  intent: String, // if you use ML intent prediction
});

module.exports = mongoose.model("Visit", visitSchema);
