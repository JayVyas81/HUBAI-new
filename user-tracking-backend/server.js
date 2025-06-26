// user-tracking-backend/server.js main file
// This is the final, corrected version of your main backend server.

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // Import cors
const http = require("http");
const { Server } = require("socket.io");

const visitRoutes = require("./routes/visitRoutes");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const server = http.createServer(app);

// --- THIS IS THE FIX ---
// We are simplifying the CORS setup to be more open, which is perfect for a local
// development environment and will solve the connection issue with the extension.
app.use(cors());

// Attach socket.io to the server AFTER the simplified CORS middleware
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for socket.io as well
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5001;

// --- Middleware ---
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Increased limit slightly
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
app.use(express.json({ limit: "1mb" })); // Increased size limit slightly

app.set("socketio", io);

// --- Routes & DB Connection ---
connectWithRetry();
app.use("/api/visits", visitRoutes);
app.get("/health", (req, res) => res.json({ status: "healthy" }));
app.use(errorHandler);

// --- Error Handlers for Stability ---
process.on("unhandledRejection", (reason, promise) => {
  console.error("--- UNHANDLED REJECTION ---", reason);
});
process.on("uncaughtException", (error) => {
  console.error("--- UNCAUGHT EXCEPTION ---", error);
  process.exit(1);
});

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`🚀 Server with WebSocket support running on port ${PORT}`);
});

function connectWithRetry() {
  mongoose
    .connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/userTracking"
    )
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
      setTimeout(connectWithRetry, 5000);
    });
}

process.on("SIGTERM", () => {
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("Server closed");
      process.exit(0);
    });
  });
});
