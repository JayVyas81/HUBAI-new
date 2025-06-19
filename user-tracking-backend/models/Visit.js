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
    openTime: { type: Date, required: true, default: Date.now },
    closeTime: { type: Date },
    timeSpent: { type: Number, min: 0 }, // This is in milliseconds
    activities: [activitySchema],
    intent: {
      type: String,
      // --- THIS IS THE FINAL FIX ---
      // "Unclassified" has been added to the list of allowed values.
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
        "Unclassified", // Added this new value
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
