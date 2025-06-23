const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 🛡️ Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'amorfly_secret');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// 🚀 GET /api/progress (Protected)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('progress nextWeeklyReset');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      eligible: user.progress.messages >= 5 && 
               user.progress.resources >= 1 && 
               user.progress.points >= 10,
      requirements: {
        messages: {
          current: user.progress.messages,
          required: 5
        },
        resources: {
          current: user.progress.resources,
          required: 1
        },
        points: {
          current: user.progress.points,
          required: 10
        }
      },
      weeklyConnectionsLeft: 1, // Optional: update later if you build logic
      nextWeeklyReset: user.nextWeeklyReset
    });
  } catch (error) {
    console.error('Progress check error:', error);
    res.status(500).json({ message: 'Failed to get progress' });
  }
});

module.exports = router;
