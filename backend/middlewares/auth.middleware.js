const jwt = require('jsonwebtoken');
const { AuthError } = require('../utils/errors');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Access token is missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AuthError('Access token is missing');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains userId, email, role, department
    next();
  } catch (err) {
    if (err instanceof AuthError || err.name === 'AuthError') {
      return next(err);
    }
    if (err instanceof jwt.TokenExpiredError || err.name === 'TokenExpiredError') {
      return next(new AuthError('Access token has expired'));
    }
    if (err instanceof jwt.JsonWebTokenError || err.name === 'JsonWebTokenError') {
      return next(new AuthError('Access token is invalid'));
    }
    return next(new AuthError(err.message || 'Authentication failed'));
  }
};
