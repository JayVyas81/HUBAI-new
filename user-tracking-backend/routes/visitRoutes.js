const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");
const { body, query, validationResult } = require("express-validator");
const axios = require("axios");

const rateLimiter = require("../middleware/rateLimiter");
const checkObjectId = require("../middleware/checkObjectId");

router.use(rateLimiter);

// The POST route should also be updated to use the new classifier
router.post(
  "/",
  [
    /* Validation rules */
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const visitData = req.body;
      const visit = new Visit(visitData);

      if (visitData.openTime && visitData.closeTime) {
        visit.timeSpent =
          new Date(visitData.closeTime) - new Date(visitData.openTime);
      }

      try {
        // Call the Python AI server's NEW /classify endpoint
        const classificationResponse = await axios.post(
          "http://localhost:5002/classify",
          {
            url: visit.url,
          }
        );
        if (
          classificationResponse.data &&
          classificationResponse.data.category
        ) {
          visit.intent = classificationResponse.data.category;
          console.log(`AI Classification Successful: ${visit.intent}`);
        }
      } catch (aiError) {
        console.error("AI classification failed:", aiError.message);
        visit.intent = "Unknown";
      }

      await visit.save();
      req.app.get("socketio").emit("new_visit", visit);
      res.status(201).json({ success: true, data: visit });
    } catch (err) {
      next(err);
    }
  }
);

// --- REPORT ENDPOINT FIX ---
// This route now calls the correct AI endpoint and aggregates the results properly.
router.get("/report/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const visits = await Visit.find({ userId }).lean();

    if (visits.length === 0) {
      return res.json({
        success: true,
        report: {},
        message: "No visits for this user.",
      });
    }

    // We don't need to re-analyze every visit. We can just count the intents
    // that were saved when the visit was first created.
    const interestProfile = visits.reduce((acc, visit) => {
      const intent = visit.intent || "Unknown";
      if (intent !== "Unknown") {
        // Only count classified visits
        acc[intent] = (acc[intent] || 0) + 1;
      }
      return acc;
    }, {});

    const classifiedVisitsCount = Object.values(interestProfile).reduce(
      (sum, count) => sum + count,
      0
    );

    if (classifiedVisitsCount > 0) {
      for (const intent in interestProfile) {
        interestProfile[intent] =
          (interestProfile[intent] / classifiedVisitsCount) * 100;
      }
    }

    res.json({ success: true, report: interestProfile });
  } catch (err) {
    next(err);
  }
});

// (Other routes remain the same)
router.get(
  "/export",
  [
    /* ... */
  ],
  async (req, res, next) => {
    /* ... */
  }
);
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
