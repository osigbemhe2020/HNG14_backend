// role.middleware.js

// Check user role middleware
const checkRole = (requiredRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
            status: 'error',
            message: 'User not authenticated'
        });
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
    });
    }

    next();
  };
};

module.exports = {
  checkRole
};