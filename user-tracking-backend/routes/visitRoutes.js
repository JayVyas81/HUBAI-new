const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");
const { body, query, validationResult } = require("express-validator");
const axios = require("axios");

// This route is not causing the crash, but the logging is kept for completeness.
router.post(
  "/",
  [
    /* validation */
  ],
  async (req, res, next) => {
    try {
      console.log("--- POST /api/visits received");
      const visitData = req.body;
      const visit = new Visit(visitData);
      const classificationResponse = await axios.post(
        "http://localhost:5002/classify",
        { url: visit.url, title: visit.title }
      );
      if (classificationResponse.data && classificationResponse.data.category) {
        visit.intent = classificationResponse.data.category;
      }
      await visit.save();
      req.app.get("socketio").emit("new_visit", visit);
      res.status(201).json({ success: true, data: visit });
    } catch (err) {
      console.error("--- CRASH REPORT (POST) ---", err);
      next(err);
    }
  }
);

// This is the route that is likely crashing the server on page load.
router.get("/export", [query("userId").notEmpty()], async (req, res, next) => {
  console.log("--- DEBUG [1/5]: /export route handler reached.");
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("--- DEBUG [2a/5]: Validation failed.", errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId } = req.query;
    console.log(`--- DEBUG [2b/5]: Querying DB for userId: ${userId}`);

    const visits = await Visit.find({ userId })
      .sort({ openTime: -1 })
      .lean()
      .exec();
    console.log(
      `--- DEBUG [3/5]: DB query successful. Found ${visits.length} visits.`
    );

    res.json({ success: true, count: visits.length, data: visits });
    console.log("--- DEBUG [4/5]: JSON response sent successfully.");
  } catch (err) {
    console.error("--- CRASH REPORT (GET /export) ---", err);
    next(err);
  }
});

// This new route generates the behavioral summary.
router.get("/summary/:userId", async (req, res, next) => {
  console.log("--- DEBUG [1/4]: /summary route handler reached.");
  try {
    const { userId } = req.params;
    const visits = await Visit.find({ userId }).lean();
    console.log(`--- DEBUG [2/4]: Found ${visits.length} visits for summary.`);

    if (visits.length < 5) {
      return res.json({
        success: true,
        summary: "Not enough browsing data to generate a detailed summary.",
      });
    }

    const intents = visits
      .map((v) => v.intent)
      .filter((i) => i && i !== "Unknown" && i !== "Unclassified");
    console.log(
      `--- DEBUG [3/4]: Sending ${intents.length} intents to AI for summary.`
    );

    const summaryResponse = await axios.post(
      "http://localhost:5002/summarize",
      { intents }
    );

    res.json({ success: true, summary: summaryResponse.data.summary });
    console.log("--- DEBUG [4/4]: Summary sent successfully.");
  } catch (err) {
    console.error("--- CRASH REPORT (GET /summary) ---", err);
    next(err);
  }
});

module.exports = router;
