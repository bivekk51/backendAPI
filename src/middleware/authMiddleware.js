const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const { asyncHandler } = require('./errorMiddleware');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      if (!token) {
        throw new AuthenticationError('Not authorized, no token provided');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        throw new AuthenticationError('User not found');
      }
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid token');
      }
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token expired');
      }
      throw error;
    }
  } else {
    throw new AuthenticationError('Not authorized, no token provided');
  }
});

const adminOnly = (req, res, next) => {
  try {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      throw new AuthorizationError('Access denied, admin only');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { protect, adminOnly };
