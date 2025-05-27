const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");

// POST /api/visits - Save a new visit
router.post("/", async (req, res) => {
  try {
    const visitData = req.body;

    if (!visitData.userId || !visitData.url || !visitData.openTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const visit = new Visit(visitData);
    await visit.save();
    res.status(201).json(visit);
  } catch (err) {
    console.error("Error saving visit:", err);
    res.status(500).json({ message: "Failed to save visit" });
  }
});

// GET /api/visits/exportVisits?userId=xxx
router.get("/exportVisits", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const visits = await Visit.find({ userId }).lean();
    res.json(visits);
  } catch (err) {
    console.error("Error fetching visits:", err);
    res.status(500).json({ error: "Failed to fetch visits" });
  }
});

module.exports = router;
