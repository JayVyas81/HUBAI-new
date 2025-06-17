const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");
const { body, query, validationResult } = require("express-validator");
const axios = require("axios");

const rateLimiter = require("../middleware/rateLimiter");
const checkObjectId = require("../middleware/checkObjectId");

router.use(rateLimiter);

// (The POST /api/visits route is correct and remains the same)
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const visitData = req.body;
      const visit = new Visit(visitData);

      if (!visit.timeSpent && visitData.openTime && visitData.closeTime) {
        visit.timeSpent =
          new Date(visitData.closeTime) - new Date(visitData.openTime);
      }

      // We will remove the real-time prediction for now to focus on the full report
      // You can add it back later if you wish.

      await visit.save();

      const io = req.app.get("socketio");
      io.emit("new_visit", visit);

      res.status(201).json({ success: true, data: visit });
    } catch (err) {
      next(err);
    }
  }
);

// --- NEW ROUTE: Generate User Interest Report ---
router.get("/report/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    console.log(`Generating report for user: ${userId}`);

    // 1. Fetch all visits for the user from the database
    const visits = await Visit.find({ userId }).lean();
    if (visits.length === 0) {
      return res.json({
        success: true,
        report: {},
        message: "No visits found for this user.",
      });
    }

    console.log(`Found ${visits.length} visits to analyze.`);

    // 2. Analyze each visit by calling the Python AI server
    const analysisPromises = visits.map((visit) =>
      axios
        .post("http://localhost:5002/analyze_topics", {
          title: visit.title,
          url: visit.url,
        })
        .then((response) => response.data.topics)
        .catch((err) => {
          console.error(`Failed to analyze URL ${visit.url}:`, err.message);
          return {}; // Return empty object on failure
        })
    );

    const allTopicAnalyses = await Promise.all(analysisPromises);

    // 3. Aggregate the results into a single interest profile
    const interestProfile = {};
    let totalWeight = 0;
    allTopicAnalyses.forEach((topics) => {
      for (const [topic, probability] of Object.entries(topics)) {
        interestProfile[topic] = (interestProfile[topic] || 0) + probability;
        totalWeight += probability;
      }
    });

    // 4. Normalize the profile to get percentages
    if (totalWeight > 0) {
      for (const topic in interestProfile) {
        interestProfile[topic] = (interestProfile[topic] / totalWeight) * 100;
      }
    }

    console.log("Generated Interest Profile:", interestProfile);

    // 5. Return the final report
    res.json({ success: true, report: interestProfile });
  } catch (err) {
    next(err);
  }
});

// (The GET /export and PUT /activities routes remain unchanged)
router.get(
  "/export",
  [
    query("userId").notEmpty(),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      next();
    },
  ],
  async (req, res, next) => {
    try {
      const { userId, startDate, endDate, domain, format = "json" } = req.query;
      const query = { userId };

      if (startDate || endDate) {
        query.openTime = {};
        if (startDate) query.openTime.$gte = new Date(startDate);
        if (endDate) query.openTime.$lte = new Date(endDate);
      }
      if (domain) {
        query.domain = { $regex: new RegExp(domain, "i") };
      }

      const visits = await Visit.find(query)
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
          unwindArrays: true,
        });
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=visits-export.csv"
        );
        return res.send(csv);
      }

      res.json({
        success: true,
        count: visits.length,
        data: visits,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:id/activities",
  checkObjectId,
  [
    body().isArray(),
    body("*.eventType")
      .notEmpty()
      .isIn(["click", "scroll", "keydown", "mousemove", "navigation"]),
    body("*.timestamp").optional().isISO8601(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const visit = await Visit.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            activities: {
              $each: req.body.map((activity) => ({
                ...activity,
                timestamp: activity.timestamp || new Date(),
              })),
            },
          },
          $set: { lastUpdated: new Date() },
        },
        { new: true, runValidators: true }
      );

      if (!visit) {
        return res
          .status(404)
          .json({ success: false, error: "Visit not found" });
      }

      res.json({ success: true, data: visit });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
