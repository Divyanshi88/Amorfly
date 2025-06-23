const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// =======================
// 🔒 Auth Middleware
// =======================
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
    console.error('❌ Token verification failed:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// =======================
// 🧾 Register
// =======================
const register = async (req, res) => {
  try {
    const { email = '', password = '', selectedSkills = [], personality = '' } = req.body;

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
};

// =======================
// 🔐 Login
// =======================
const login = async (req, res) => {
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
};

// =======================
// 👤 Get Profile
// =======================
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password')
      .populate('currentPod');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      anonymousName: user.anonymousName || null,
      selectedSkills: user.selectedSkills,
      progressPoints: user.progressPoints || 0,
      currentPod: user.currentPod || null
    });

  } catch (error) {
    console.error('❌ Get profile error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  authMiddleware
};
