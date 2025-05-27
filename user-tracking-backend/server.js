// user-tracking-backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const visitRoutes = require("./routes/visitRoutes");

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/userTracking", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on("connected", () => {
  console.log("✅ Connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

// Mount the routes at /api/visits
app.use("/api/visits", visitRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
