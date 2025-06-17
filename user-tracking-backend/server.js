// user-tracking-backend/server.js

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http"); // Import Node's built-in HTTP module
const { Server } = require("socket.io"); // Import the socket.io Server

const visitRoutes = require("./routes/visitRoutes");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const server = http.createServer(app); // Create an HTTP server from the Express app

// Attach socket.io to the server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5001;

// --- Middleware ---
const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:3000"];
const corsOptions = {
  origin: (origin, callback) => {
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
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
app.use(express.json({ limit: "10kb" }));

// --- Make the 'io' instance available to our routes ---
app.set("socketio", io);

// --- Routes & DB Connection ---
connectWithRetry();
app.use("/api/visits", visitRoutes);
app.get("/health", (req, res) => res.json({ status: "healthy" }));
app.use(errorHandler);

// --- Start Server ---
// Change app.listen to server.listen to start the combined server
server.listen(PORT, () => {
  console.log(`🚀 Server with WebSocket support running on port ${PORT}`);
});

// (Your connectWithRetry and graceful shutdown logic remains the same)
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
