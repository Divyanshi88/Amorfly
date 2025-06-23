const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Pod = require('../models/Pod');
const Connection = require('../models/Connection');

const router = express.Router();

// 🔐 Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'amorfly_secret');
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// 📊 Connection Eligibility Check
const checkConnectionEligibility = async (userId) => {
  const user = await User.findById(userId);

  const minMessages = 5;
  const minResourcesShared = 1;
  const minProgressPoints = 10;

  const participation = user.podParticipation || { messagesCount: 0, resourcesShared: 0 };

  const isEligible =
    participation.messagesCount >= minMessages &&
    participation.resourcesShared >= minResourcesShared &&
    (user.progressPoints || 0) >= minProgressPoints;

  return {
    eligible: isEligible,
    requirements: {
      messages: { current: participation.messagesCount, required: minMessages },
      resources: { current: participation.resourcesShared, required: minResourcesShared },
      points: { current: user.progressPoints || 0, required: minProgressPoints }
    }
  };
};

// 🔁 Weekly Connection Reset
const resetWeeklyConnections = async (user) => {
  // Ensure weeklyConnections object exists
  if (!user.weeklyConnections) {
    user.weeklyConnections = {
      count: 0,
      weekStartDate: new Date()
    };
    await user.save();
    return user;
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (user.weeklyConnections.weekStartDate < oneWeekAgo) {
    user.weeklyConnections.count = 0;
    user.weeklyConnections.weekStartDate = new Date();
    await user.save();
  }

  return user;
};


// 🔍 Discover 1:1 Connections
router.get('/discover', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const eligibility = await checkConnectionEligibility(user._id);

    if (!eligibility.eligible) {
      return res.status(403).json({
        message: 'Not eligible for 1:1 connections yet',
        requirements: eligibility.requirements
      });
    }

    await resetWeeklyConnections(user);

    if (user.weeklyConnections.count >= 1) {
      const nextWeek = new Date(user.weeklyConnections.weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      return res.status(429).json({
        message: 'Weekly connection limit reached',
        nextAvailable: nextWeek
      });
    }

    const potentialConnections = await User.find({
      _id: { $ne: user._id },
      selectedSkills: { $in: user.selectedSkills },
      isActive: true,
      progressPoints: { $gte: 10 }
    }).select('anonymousName selectedSkills personality progressPoints');

    const scored = potentialConnections.map(p => {
      const sharedSkills = user.selectedSkills.filter(skill => p.selectedSkills.includes(skill));
      let score = 0;

      if (user.personality.learningStyle === p.personality.learningStyle) score += 0.4;
      if (user.personality.motivation === p.personality.motivation) score += 0.35;
      if (user.personality.timeCommitment === p.personality.timeCommitment) score += 0.25;

      const skillBonus = Math.min(sharedSkills.length * 0.1, 0.3);
      score += skillBonus;

      return {
        user: {
          id: p._id,
          anonymousName: p.anonymousName,
          progressPoints: p.progressPoints
        },
        sharedSkills,
        compatibilityScore: Math.round(score * 100) / 100,
        matchStrength: score > 0.7 ? 'High' : score > 0.5 ? 'Medium' : 'Low'
      };
    }).filter(c => c.compatibilityScore > 0.3)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 5);

    res.json({
      message: 'Potential connections found',
      connections: scored,
      weeklyConnectionsLeft: 1 - user.weeklyConnections.count
    });
  } catch (err) {
    console.error('Discover error:', err);
    res.status(500).json({ message: 'Error finding connections' });
  }
});

// 📩 Send Connection Request
router.post('/request', authMiddleware, async (req, res) => {
  const { targetUserId, sharedSkill } = req.body;

  try {
    const user = await User.findById(req.userId);
    const target = await User.findById(targetUserId);

    if (!target) return res.status(404).json({ message: 'Target user not found' });

    const eligibility = await checkConnectionEligibility(req.userId);
    if (!eligibility.eligible) {
      return res.status(403).json({ message: 'Not eligible', requirements: eligibility.requirements });
    }

    await resetWeeklyConnections(user);
    if (user.weeklyConnections.count >= 1) {
      return res.status(429).json({ message: 'Weekly connection limit reached' });
    }

    const existing = await Connection.findOne({
      users: { $all: [req.userId, targetUserId] },
      status: { $in: ['pending', 'active'] }
    });
    if (existing) return res.status(400).json({ message: 'Connection already exists' });

    if (!user.selectedSkills.includes(sharedSkill) || !target.selectedSkills.includes(sharedSkill)) {
      return res.status(400).json({ message: 'Skill not shared by both users' });
    }

    const conn = new Connection({
      users: [req.userId, targetUserId],
      sharedSkill,
      initiatedBy: req.userId,
      status: 'pending'
    });

    await conn.save();
    user.weeklyConnections.count += 1;
    await user.save();

    res.status(201).json({
      message: 'Connection request sent',
      connection: {
        id: conn._id,
        sharedSkill,
        status: conn.status,
        evaluationPeriod: conn.evaluationPeriod
      }
    });
  } catch (err) {
    console.error('Connection request error:', err);
    res.status(500).json({ message: 'Error sending connection request' });
  }
});

// ✅ Respond to Request
router.post('/:connectionId/respond', authMiddleware, async (req, res) => {
  const { connectionId } = req.params;
  const { response } = req.body;

  try {
    const conn = await Connection.findById(connectionId);
    if (!conn) return res.status(404).json({ message: 'Connection not found' });

    if (!conn.users.includes(req.userId)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (conn.initiatedBy.toString() === req.userId) {
      return res.status(400).json({ message: 'Cannot respond to your own request' });
    }

    if (response === 'accept') {
      conn.status = 'active';
      conn.evaluationPeriod.startDate = new Date();
      await conn.save();

      res.json({ message: 'Connection accepted', connection: conn });
    } else {
      await Connection.findByIdAndDelete(connectionId);
      res.json({ message: 'Connection rejected' });
    }
  } catch (err) {
    console.error('Respond error:', err);
    res.status(500).json({ message: 'Error responding to connection' });
  }
});

// 👥 Get User's Connections
router.get('/my-connections', authMiddleware, async (req, res) => {
  try {
    const connections = await Connection.find({
      users: req.userId,
      status: { $in: ['pending', 'active'] }
    }).populate('users', 'anonymousName progressPoints');

    const formatted = connections.map(c => {
      const other = c.users.find(u => u._id.toString() !== req.userId);
      return {
        id: c._id,
        otherUser: {
          id: other._id,
          anonymousName: other.anonymousName,
          progressPoints: other.progressPoints
        },
        sharedSkill: c.sharedSkill,
        status: c.status,
        initiatedBy: c.initiatedBy.toString() === req.userId ? 'me' : 'them',
        evaluationPeriod: c.evaluationPeriod,
        analytics: c.analytics,
        daysRemaining: Math.ceil((c.evaluationPeriod.endDate - new Date()) / (1000 * 60 * 60 * 24))
      };
    });

    res.json({ connections: formatted, total: formatted.length });
  } catch (err) {
    console.error('Get connections error:', err);
    res.status(500).json({ message: 'Error fetching connections' });
  }
});

// ... existing code ...

// 📝 Submit Feedback for a 1:1 Connection
router.post('/:connectionId/feedback', authMiddleware, async (req, res) => {
  const { connectionId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  // Validate connection ID format
  if (!mongoose.isValidObjectId(connectionId)) {
    return res.status(400).json({ 
      message: 'Invalid connection ID format',
      receivedId: connectionId
    });
  }

  try {
    const connection = await Connection.findById(connectionId);
    if (!connection) {
      console.error(`❌ Connection not found: ${connectionId}`);
      return res.status(404).json({ 
        message: 'Connection not found',
        connectionId 
      });
    }

    // Convert to string for consistent comparison
    const userId = req.userId.toString();
    const userIds = connection.users.map(id => id.toString());

    // Ensure user is part of this connection
    if (!userIds.includes(userId)) {
      console.error(`🚫 User ${userId} not in connection ${connectionId}`);
      return res.status(403).json({ 
        message: 'Not authorized to submit feedback for this connection' 
      });
    }

    // Check for existing feedback
    const existingFeedback = connection.feedback.find(
      f => f.fromUser.toString() === userId
    );
    
    if (existingFeedback) {
      return res.status(400).json({ 
        message: 'Feedback already submitted for this connection' 
      });
    }

    // Add new feedback
    connection.feedback.push({
      fromUser: userId,
      rating,
      comment: comment || '',
      isAnonymous: true
    });

    // Complete connection if both feedbacks submitted
    if (connection.feedback.length >= 2) {
      connection.status = 'completed';
      connection.evaluationPeriod.endDate = new Date();
    }

    await connection.save();

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      connectionStatus: connection.status,
      feedbackCount: connection.feedback.length
    });
  } catch (error) {
    console.error('❌ Feedback submission error:', {
      connectionId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Error submitting feedback',
      error: error.message
    });
  }
});

// ... existing code ...



router.get('/eligibility', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    await resetWeeklyConnections(user);

    const eligibility = await checkConnectionEligibility(req.userId);

    const weeklyConnectionsLeft = user.weeklyConnections?.count !== undefined
      ? 1 - user.weeklyConnections.count
      : 1;

    const nextWeeklyReset = user.weeklyConnections?.weekStartDate
      ? new Date(user.weeklyConnections.weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      : null;

    res.json({
      ...eligibility,
      weeklyConnectionsLeft,
      nextWeeklyReset
    });
  } catch (err) {
    console.error('Eligibility check error:', err);
    res.status(500).json({ message: 'Error checking eligibility' });
  }
});


// 🔓 Manual Unlock (if eligible)
router.post('/unlock', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const eligibility = await checkConnectionEligibility(user._id);

    if (!eligibility.eligible) {
      return res.status(403).json({
        message: 'Not eligible to unlock connection',
        requirements: eligibility.requirements
      });
    }

    user.connectionUnlocked = true;
    await user.save();

    res.json({
      success: true,
      message: '1:1 connection unlocked successfully',
      userId: user._id,
      progressPoints: user.progressPoints
    });
  } catch (err) {
    console.error('🔓 Unlock error:', err);
    res.status(500).json({ message: 'Error unlocking 1:1 connection' });
  }
});


module.exports = router;
