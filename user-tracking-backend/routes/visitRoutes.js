const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");
const { body, validationResult } = require("express-validator");

// POST /api/visits - Save a new visit with validation
router.post(
  "/",
  [
    body("userId").notEmpty().isString(),
    body("url").isURL(),
    body("openTime").optional().isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const visit = new Visit(req.body);
      await visit.save();

      // Calculate duration if closeTime is provided
      if (req.body.closeTime) {
        visit.timeSpent =
          (new Date(req.body.closeTime) - new Date(visit.openTime)) / 1000;
        await visit.save();
      }

      res.status(201).json(visit);
    } catch (err) {
      console.error("Error saving visit:", err);
      res.status(500).json({
        message: "Failed to save visit",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

// GET /api/visits/export - Enhanced export with filtering
router.get("/export", async (req, res) => {
  const { userId, startDate, endDate, domain } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing required userId parameter" });
  }

  try {
    const query = { userId };

    // Date filtering
    if (startDate || endDate) {
      query.openTime = {};
      if (startDate) query.openTime.$gte = new Date(startDate);
      if (endDate) query.openTime.$lte = new Date(endDate);
    }

    // Domain filtering
    if (domain) {
      query.domain = domain;
    }

    const visits = await Visit.find(query).sort({ openTime: -1 }).lean();

    // Format for CSV if requested
    if (req.query.format === "csv") {
      const csv = visits.map((v) => ({
        URL: v.url,
        Title: v.title,
        "Time Spent (s)": v.timeSpent,
        "Start Time": v.openTime.toISOString(),
        "End Time": v.closeTime?.toISOString() || "",
        Intent: v.intent,
      }));

      // Convert to CSV string (would need a proper CSV package for production)
      res.setHeader("Content-Type", "text/csv");
      return res.send(
        Object.keys(csv[0]).join(",") +
          "\n" +
          csv.map((o) => Object.values(o).join(",")).join("\n")
      );
    }

    res.json(visits);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({
      error: "Failed to export visits",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// New endpoint for bulk activity updates
router.post("/:id/activities", async (req, res) => {
  try {
    const visit = await Visit.findByIdAndUpdate(
      req.params.id,
      { $push: { activities: { $each: req.body } } },
      { new: true }
    );

    if (!visit) {
      return res.status(404).json({ error: "Visit not found" });
    }

    res.json(visit);
  } catch (err) {
    res.status(500).json({ error: "Failed to update activities" });
  }
});

module.exports = router;
