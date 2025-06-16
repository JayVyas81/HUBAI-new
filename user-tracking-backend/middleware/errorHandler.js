const errorHandler = (err, req, res, next) => {
  // Log the error for debugging purposes
  console.error(err.stack);

  // Determine the status code. Default to 500 (Internal Server Error)
  const statusCode = res.statusCode ? res.statusCode : 500;

  res.status(statusCode);

  res.json({
    success: false,
    message: err.message,
    // Provide stack trace only in development environment for security
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = {
  errorHandler,
};
