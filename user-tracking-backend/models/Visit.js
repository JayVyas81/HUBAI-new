const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["click", "scroll", "keydown", "mousemove", "tabchange"],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    coordinates: { x: Number, y: Number }, // For mouse events
    element: String, // DOM element interacted with
    duration: Number, // For sustained activities
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
    domain: { type: String, index: true }, // Extracted domain for faster queries
    title: { type: String, trim: true },
    tabId: { type: String },
    openTime: { type: Date, required: true, default: Date.now },
    closeTime: { type: Date },
    timeSpent: { type: Number, min: 0 }, // in seconds
    activities: [activitySchema],
    intent: {
      type: String,
      enum: [
        "Research",
        "Shopping",
        "Entertainment",
        "Communication",
        "Work",
        "Unknown",
      ],
      default: "Unknown",
    },
    screenshot: String, // Base64 thumbnail for visual context
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add pre-save hook to extract domain
visitSchema.pre("save", function (next) {
  try {
    this.domain = new URL(this.url).hostname.replace("www.", "");
  } catch (e) {
    this.domain = "invalid";
  }
  next();
});

/*
// --- THIS BLOCK WAS CAUSING THE ERROR AND HAS BEEN REMOVED ---
// This code tried to run the machine learning analysis every time a visit was saved.
// This is not the correct architectural pattern. The ML analysis should be run as a
// separate process on the data after it has been saved.
visitSchema.pre("save", async function (next) {
  if (this.isNew) {
    const analyzer = require("../user-intent-ml/behaviorAnalyzer");
    this.intent = await analyzer.analyzeVisit(this);
  }
  next();
});
*/

module.exports = mongoose.model("Visit", visitSchema);
