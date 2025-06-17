// user-tracking-backend/routes/visitRoutes.js

const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");
const { body, query, validationResult } = require("express-validator");

const rateLimiter = require("../middleware/rateLimiter");
const checkObjectId = require("../middleware/checkObjectId");

router.use(rateLimiter);

// POST /api/visits
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

      // This logic is now handled by the extension, but we can keep it as a fallback.
      if (!visit.timeSpent && visitData.openTime && visitData.closeTime) {
        visit.timeSpent =
          (new Date(visitData.closeTime) - new Date(visitData.openTime)) / 1000;
      }

      await visit.save();

      // --- REAL-TIME UPDATE ---
      // Get the socket.io instance and emit a 'new_visit' event to all clients
      const io = req.app.get("socketio");
      io.emit("new_visit", visit); // Broadcast the newly saved visit

      res.status(201).json({ success: true, data: visit });
    } catch (err) {
      next(err);
    }
  }
);

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
