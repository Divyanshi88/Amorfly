// routes/analytics.js
const express = require('express');
const User = require('../models/User');
const Pod = require('../models/Pod');
const Message = require('../models/Message');

const router = express.Router();

router.get('/community', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPods = await Pod.countDocuments();

    const avgProgress = await User.aggregate([
      { $group: { _id: null, avgPoints: { $avg: "$progressPoints" } } }
    ]);

    const mostPopularSkill = await User.aggregate([
      { $unwind: "$selectedSkills" },
      { $group: { _id: "$selectedSkills", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const activeUsers = await Message.distinct("userId", {
      createdAt: { $gte: last7Days }
    });

    res.json({
      success: true,
      summary: {
        totalUsers,
        totalPods,
        averageProgressPoints: avgProgress[0]?.avgPoints?.toFixed(2) || 0,
        mostPopularSkill: mostPopularSkill[0]?._id || "N/A",
        activeUsersLast7Days: activeUsers.length
      }
    });
  } catch (error) {
    console.error('🔴 Community Analytics Error:', error);
    res.status(500).json({ message: 'Failed to fetch community analytics' });
  }
});

module.exports = router;
