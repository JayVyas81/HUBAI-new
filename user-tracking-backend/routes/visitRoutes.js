const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");
const { body, query, validationResult } = require("express-validator");
const axios = require("axios");

const rateLimiter = require("../middleware/rateLimiter");
const checkObjectId = require("../middleware/checkObjectId");

router.use(rateLimiter);

// --- POST /api/visits - WITH DETAILED LOGGING ---
router.post(
  "/",
  [
    body("userId").notEmpty().isString(),
    body("url").isURL(),
    body("title").optional().isString(),
    body("openTime").optional().isISO8601(),
    body("closeTime").optional().isISO8601(),
  ],
  async (req, res, next) => {
    console.log("--- POST DEBUG: Step 1 - /visits POST handler reached.");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(
        "--- POST DEBUG: Step 2a - Validation failed.",
        errors.array()
      );
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      console.log(
        "--- POST DEBUG: Step 2b - Validation passed. Body:",
        req.body
      );
      const visitData = req.body;
      const visit = new Visit(visitData);

      // The timeSpent value is already correctly sent in milliseconds by the extension
      // This is just a fallback.
      if (!visit.timeSpent && visitData.openTime && visitData.closeTime) {
        visit.timeSpent =
          new Date(visitData.closeTime) - new Date(visitData.openTime);
      }

      console.log("--- POST DEBUG: Step 3 - Attempting AI classification.");
      try {
        const classificationResponse = await axios.post(
          "http://localhost:5002/classify",
          {
            url: visit.url,
            title: visit.title,
          }
        );
        if (
          classificationResponse.data &&
          classificationResponse.data.category
        ) {
          visit.intent = classificationResponse.data.category;
          console.log(
            `--- POST DEBUG: Step 4a - AI Classification successful: ${visit.intent}`
          );
        }
      } catch (aiError) {
        console.error(
          "--- POST DEBUG: Step 4b - AI classification failed:",
          aiError.message
        );
        visit.intent = "Unknown";
      }

      console.log(
        "--- POST DEBUG: Step 5 - Attempting to save visit to database."
      );
      await visit.save();
      console.log("--- POST DEBUG: Step 6 - Visit saved successfully.");

      req.app.get("socketio").emit("new_visit", visit);
      console.log("--- POST DEBUG: Step 7 - Real-time update emitted.");

      res.status(201).json({ success: true, data: visit });
    } catch (err) {
      console.error(
        "--- CRASH REPORT (POST): An error occurred during visit save ---",
        err
      );
      next(err);
    }
  }
);

// (The other routes are correct and remain the same)
router.get("/export", [query("userId").notEmpty()], async (req, res, next) => {
  try {
    const { userId, format = "json" } = req.query;
    const visits = await Visit.find({ userId })
      .sort({ openTime: -1 })
      .lean()
      .exec();
    if (format.toLowerCase() === "csv") {
      const { json2csv } = await import("json-2-csv");
      const csv = await json2csv(visits, {
        fields: [
          "url",
          "title",
          "timeSpent",
          "openTime",
          "closeTime",
          "intent",
          "domain",
        ],
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=visits-export.csv"
      );
      return res.send(csv);
    }
    res.json({ success: true, count: visits.length, data: visits });
  } catch (err) {
    next(err);
  }
});
router.get("/report/:userId", async (req, res, next) => {
  /* ... */
});
router.put(
  "/:id/activities",
  checkObjectId,
  [
    /* ... */
  ],
  async (req, res, next) => {
    /* ... */
  }
);

module.exports = router;
