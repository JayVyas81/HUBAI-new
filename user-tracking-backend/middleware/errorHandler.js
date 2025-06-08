const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");
const { body, validationResult } = require("express-validator");
const { validateRequest } = require("../middleware/validateRequest");
const { rateLimiter } = require("../middleware/rateLimiter");
const { checkObjectId } = require("../middleware/checkObjectId");

// Apply rate limiting to all visit routes
router.use(rateLimiter);

// POST /api/visits - Save a new visit with comprehensive validation
router.post(
  "/",
  [
    body("userId")
      .notEmpty()
      .isString()
      .withMessage("User ID must be a valid string"),
    body("url")
      .isURL()
      .withMessage("Invalid URL format")
      .customSanitizer((value) => {
        try {
          new URL(value);
          return value;
        } catch {
          throw new Error("Invalid URL");
        }
      }),
    body("openTime")
      .optional()
      .isISO8601()
      .withMessage("Invalid ISO8601 date format"),
    body("closeTime")
      .optional()
      .isISO8601()
      .withMessage("Invalid ISO8601 date format"),
    body("intent")
      .optional()
      .isIn(["Research", "Shopping", "Entertainment", "Work", "Unknown"])
      .withMessage("Invalid intent value"),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
      const visitData = req.body;
      const visit = new Visit(visitData);

      // Calculate duration if both timestamps exist
      if (visitData.openTime && visitData.closeTime) {
        visit.timeSpent =
          (new Date(visitData.closeTime) - new Date(visitData.openTime)) / 1000;
      }

      await visit.save();

      res.status(201).json({
        success: true,
        data: visit,
      });
    } catch (err) {
      next(err); // Pass to error handler
    }
  }
);

// GET /api/visits/export - Enhanced export with advanced filtering
router.get(
  "/export",
  [
    body("userId").notEmpty().withMessage("User ID is required"),
    body("startDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid start date format"),
    body("endDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid end date format"),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
      const { userId, startDate, endDate, domain, format = "json" } = req.query;
      const query = { userId };

      // Date range filtering
      if (startDate || endDate) {
        query.openTime = {};
        if (startDate) query.openTime.$gte = new Date(startDate);
        if (endDate) query.openTime.$lte = new Date(endDate);
      }

      // Domain filtering with case-insensitive regex
      if (domain) {
        query.domain = { $regex: new RegExp(domain, "i") };
      }

      const visits = await Visit.find(query)
        .sort({ openTime: -1 })
        .lean()
        .exec();

      // Handle different response formats
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

// PUT /api/visits/:id/activities - Bulk activity updates with validation
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
    validateRequest,
  ],
  async (req, res, next) => {
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
