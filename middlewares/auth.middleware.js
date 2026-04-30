const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Verify JWT and check user active status
const verifyToken = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check cookie first (web portal uses HTTP-only cookies)
    if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    }
    
    // 2. Fall back to Authorization header (CLI uses Bearer tokens)
    if (!token) {
      const authHeader = req.headers.authorization;
      
      if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }
    }

    // No token found in either place
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authorization header missing'
      });
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token has expired'
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token'
        });
      }
      throw error;
    }

    // Fetch user from database
    const user = await User.findOne({ id: decoded.sub });
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'User account is not active'
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
      status: 'error',
      message: 'Authentication verification failed'
    });
  }
};

module.exports = {
  verifyToken
};