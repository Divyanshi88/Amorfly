const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// =========================
// 🔒 AUTH MIDDLEWARE
// =========================
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'amorfly_secret');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// =========================
// 🔐 REGISTER
// =========================
router.post('/register', async (req, res) => {
  try {
    const {
      email = '',
      password = '',
      selectedSkills = [],
      personality = ''
    } = req.body;

    if (!email || !password || !selectedSkills.length || !personality) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email,
      password: hashedPassword,
      selectedSkills,
      personality
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'amorfly_secret',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        anonymousName: user.anonymousName || null,
        selectedSkills: user.selectedSkills,
        progressPoints: user.progressPoints || 0
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// =========================
// 🔐 LOGIN
// =========================
router.post('/login', async (req, res) => {
  try {
    const { email = '', password = '' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    const isMatch = user && await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'amorfly_secret',
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        anonymousName: user.anonymousName || null,
        selectedSkills: user.selectedSkills,
        progressPoints: user.progressPoints || 0,
        currentPod: user.currentPod || null
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// =========================
// 🙋‍♀️ GET CURRENT USER PROFILE
// =========================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('currentPod');

    // 🧠 Generate anonymousName if missing
    if (!user.anonymousName) {
      const generateAnonymousName = require('../utils/generateAnonymousName');
      user.anonymousName = generateAnonymousName();
      await user.save();
    }

    res.json({
      id: user._id,
      email: user.email,
      anonymousName: user.anonymousName,
      selectedSkills: user.selectedSkills,
      progressPoints: user.progressPoints,
      currentPod: user.currentPod
    });

  } catch (err) {
    console.error('❌ Get profile error:', err);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

   
// =========================
// 🌱 GET USER PROGRESS POINTS
// =========================
router.get('/me/progress', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('anonymousName progressPoints');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      success: true,
      user: {
        _id: user._id,
        anonymousName: user.anonymousName,
        progressPoints: user.progressPoints
      }
    });
  } catch (error) {
    console.error('🔴 Error fetching progress points:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
