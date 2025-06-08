const { celebrate, Joi } = require("celebrate");

module.exports = {
  createVisit: celebrate({
    body: Joi.object({
      userId: Joi.string().required(),
      url: Joi.string().uri().required(),
      title: Joi.string(),
      openTime: Joi.date().iso(),
      closeTime: Joi.date().iso().greater(Joi.ref("openTime")),
      intent: Joi.string().valid(
        "Research",
        "Shopping",
        "Entertainment",
        "Work",
        "Unknown"
      ),
    }),
  }),

  getVisits: celebrate({
    query: Joi.object({
      userId: Joi.string().required(),
      startDate: Joi.date().iso(),
      endDate: Joi.date()
        .iso()
        .when("startDate", {
          is: Joi.exist(),
          then: Joi.date().min(Joi.ref("startDate")),
        }),
      domain: Joi.string(),
      format: Joi.string().valid("json", "csv"),
    }),
  }),
};
