// apiVersion.middleware.js

// API Versioning middleware
const checkApiVersion = (req, res, next) => {
  // Only check API version for /api routes
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  const apiVersion = req.get('X-API-Version');

  if (!apiVersion) {
    return res.status(400).json({
      status: "error",
      message: "API version header required"
    });
  }

  // Optional: Validate supported versions
  const supportedVersions = ['1', '2'];
  if (!supportedVersions.includes(apiVersion)) {
    return res.status(400).json({
      status: "error",
      message: `Unsupported API version: ${apiVersion}. Supported versions: ${supportedVersions.join(', ')}`
    });
  }

  // Add version to request object for use in other middleware/routes
  req.apiVersion = apiVersion;
  
  next();
};

module.exports = {
  checkApiVersion
};
