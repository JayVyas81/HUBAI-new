// user-tracking-backend/models/Visit.js

const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["click", "scroll", "keydown", "mousemove", "tabchange"],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    coordinates: { x: Number, y: Number },
    element: String,
  },
  { _id: false }
);

const visitSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    url: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(v),
        message: (props) => `${props.value} is not a valid URL!`,
      },
    },
    domain: { type: String, index: true },
    title: { type: String, trim: true },
    tabId: { type: String },
    // --- THIS IS THE FIX ---
    // Added `index: -1` to optimize sorting by this field in descending order.
    // This will make your dashboard load instantly.
    openTime: { type: Date, required: true, default: Date.now, index: -1 },
    closeTime: { type: Date },
    timeSpent: { type: Number, min: 0 }, // This is in milliseconds
    activities: [activitySchema],
    intent: {
      type: String,
      enum: [
        "Adult",
        "Business/Corporate",
        "Computers and Technology",
        "E-Commerce",
        "Education",
        "Entertainment",
        "Food",
        "Forums",
        "Games",
        "Health and Fitness",
        "Law and Government",
        "News",
        "Photography",
        "Social Networking and Messaging",
        "Sports",
        "Streaming Services",
        "Travel",
        "Unclassified",
        "Unknown",
      ],
      default: "Unknown",
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to extract domain
visitSchema.pre("save", function (next) {
  try {
    this.domain = new URL(this.url).hostname.replace("www.", "");
  } catch (e) {
    this.domain = "invalid";
  }
  next();
});

module.exports = mongoose.model("Visit", visitSchema);
