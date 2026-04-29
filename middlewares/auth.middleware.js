
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Verify JWT and check user active status
const verifyToken = async (req, res, next) => {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Authorization header missing',
        data: null
      });
    }

    // Extract Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        statusCode: 401,
        message: 'Invalid authorization header format. Use: Bearer <token>',
        data: null
      });
    }

    const token = parts[1];

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          statusCode: 401,
          message: 'Token has expired',
          data: null
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          statusCode: 401,
          message: 'Invalid token',
          data: null
        });
      }
      throw error;
    }

    // Fetch user from database
    const user = await User.findOne({ id: decoded.sub });
    
    if (!user) {
      return res.status(401).json({
        statusCode: 401,
        message: 'User not found',
        data: null
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        statusCode: 403,
        message: 'User account is not active',
        data: null
      });
    }

    // Attach user to request object
    req.user = {
      id: user._id,
      uuid: user.id,
      github_id: user.github_id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      role: user.role,
      is_active: user.is_active
    };

    next();

  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(500).json({
      statusCode: 500,
      message: 'Authentication verification failed',
      data: null
    });
  }
};

module.exports = {
  verifyToken
};
