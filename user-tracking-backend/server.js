require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const visitRoutes = require("./routes/visitRoutes");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    optionsSuccessStatus: 200,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing with size limit
app.use(express.json({ limit: "10kb" }));

// MongoDB connection with retry logic
const connectWithRetry = () => {
  mongoose
    .connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/userTracking",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
      }
    )
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
      setTimeout(connectWithRetry, 5000);
    });
};
connectWithRetry();

// Routes
app.use("/api/visits", visitRoutes);

// Health check endpoint
app.get("/health", (req, res) => res.json({ status: "healthy" }));

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("Server closed");
      process.exit(0);
    });
  });
});
