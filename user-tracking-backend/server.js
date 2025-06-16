require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const visitRoutes = require("./routes/visitRoutes");
const helmet = require("helmet");
// --- THIS IS THE FIX ---
// The package is now correctly required.
const rateLimit = require("express-rate-limit");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:3000"];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or browser extensions)
    // or requests from the allowed frontend URL.
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.startsWith("chrome-extension://")
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  optionsSuccessStatus: 200,
};

app.use(helmet());
app.use(cors(corsOptions)); // Use the new dynamic cors options

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
