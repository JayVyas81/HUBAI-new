const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");
const { body, query, validationResult } = require("express-validator");

const rateLimiter = require("../middleware/rateLimiter");
const checkObjectId = require("../middleware/checkObjectId");

// Apply rate limiting to all visit routes
router.use(rateLimiter);

// POST /api/visits - Save a new visit with comprehensive validation
router.post(
  "/",
  [
    // Validation rules are defined here
    body("userId")
      .notEmpty()
      .isString()
      .withMessage("User ID must be a valid string"),
    body("url").isURL().withMessage("Invalid URL format"),
    body("title").optional().isString(),
    body("openTime")
      .optional()
      .isISO8601()
      .withMessage("Invalid ISO8601 date format"),
    body("closeTime")
      .optional()
      .isISO8601()
      .withMessage("Invalid ISO8601 date format"),
  ],
  async (req, res, next) => {
    // --- THIS IS THE FIX ---
    // We now handle the validation result directly inside the route handler,
    // bypassing the potentially faulty `validateRequest` middleware.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("---VALIDATION FAILED---:", errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // --- LOG 1 ---
    console.log("---LOG 1: POST /api/visits handler reached. Body:", req.body);

    try {
      const visitData = req.body;
      const visit = new Visit(visitData);

      if (visitData.openTime && visitData.closeTime) {
        visit.timeSpent =
          (new Date(visitData.closeTime) - new Date(visitData.openTime)) / 1000;
      }

      // --- LOG 2 ---
      console.log("---LOG 2: Attempting to save visit...");
      await visit.save();
      // --- LOG 3 ---
      console.log("---LOG 3: Visit saved successfully!");

      res.status(201).json({
        success: true,
        data: visit,
      });
    } catch (err) {
      // --- LOG 4 ---
      console.error("---LOG 4: Error during visit save:", err);
      next(err); // Pass to error handler
    }
  }
);

// GET /api/visits/export - This route remains the same
router.get(
  "/export",
  [
    query("userId")
      .notEmpty()
      .withMessage("User ID is required in query parameters"),
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid start date format"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid end date format"),
    (req, res, next) => {
      // Manual validation for GET route
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

// PUT /api/visits/:id/activities - This route remains the same
router.put(
  "/:id/activities",
  checkObjectId,
  [
    body().isArray().withMessage("Activities must be an array"),
    body("*.eventType")
      .notEmpty()
      .isIn(["click", "scroll", "keydown", "mousemove", "navigation"])
      .withMessage("Invalid event type"),
    body("*.timestamp")
      .optional()
      .isISO8601()
      .withMessage("Invalid timestamp format"),
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
        return res.status(404).json({
          success: false,
          error: "Visit not found",
        });
      }

      res.json({
        success: true,
        data: visit,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
