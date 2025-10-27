const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  let token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  // ✅ Handle both "Bearer <token>" and plain "<token>"
  if (token.startsWith('Bearer ')) {
    token = token.slice(7, token.length).trim();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded; // ✅ ensures req.user.isAdmin etc. are available
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
