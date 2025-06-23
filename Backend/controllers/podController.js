// ============================================
// 1. UPDATE YOUR podController.js
// ============================================

const User = require('../models/User');
const Pod = require('../models/Pod');
const Message = require('../models/Message');
const { updateUserProgress } = require('../utils/progressUtils');

// 🎭 Helper function to generate and assign anonymous name
const generateAnonymousName = () => {
  const adjectives = [
    'Sky', 'Ocean', 'Star', 'Moon', 'Sun', 'Cloud', 'Dream', 'Fire', 'Wind', 'Stone',
    'River', 'Mountain', 'Forest', 'Thunder', 'Lightning', 'Aurora', 'Crystal', 'Silver',
    'Golden', 'Diamond', 'Mystic', 'Cosmic', 'Phoenix', 'Dragon', 'Eagle', 'Wolf'
  ];
  
  const nouns = [
    'Walker', 'Seeker', 'Rider', 'Hunter', 'Thinker', 'Flier', 'Coder', 'Builder',
    'Creator', 'Explorer', 'Guardian', 'Warrior', 'Sage', 'Scholar', 'Artist', 'Dreamer',
    'Pioneer', 'Voyager', 'Champion', 'Master', 'Ninja', 'Wizard', 'Knight', 'Ranger'
  ];
  
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNumber = Math.floor(100 + Math.random() * 900);
  
  return `${randomAdjective}${randomNoun}_${randomNumber}`;
};

// 🎭 Ensure user has anonymous name
const ensureAnonymousName = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // If user doesn't have an anonymous name, generate one
    if (!user.anonymousName) {
      user.anonymousName = generateAnonymousName();
      await user.save();
      console.log('🎭 Anonymous name generated and saved:', user.anonymousName);
    }

    return user.anonymousName;
  } catch (error) {
    console.error('❌ Error ensuring anonymous name:', error);
    throw error;
  }
};

// 🔐 Join or create a pod (UPDATED)
const joinPod = async (req, res) => {
  try {
    console.log('📍 joinPod called for user:', req.userId);
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // ✅ GENERATE ANONYMOUS NAME FIRST
    if (!user.anonymousName) {
      user.anonymousName = generateAnonymousName();
      await user.save();
      console.log('🎭 New anonymous name assigned:', user.anonymousName);
    }

    // Check if user already has a pod
    if (user.currentPod) {
      const existingPod = await Pod.findById(user.currentPod);
      if (existingPod && existingPod.isActive) {
        return res.json({
          success: true,
          message: 'User already in a pod',
          podId: existingPod._id,
          anonymousName: user.anonymousName,
          user: {
            id: user._id,
            email: user.email,
            anonymousName: user.anonymousName,
            selectedSkills: user.selectedSkills,
            progressPoints: user.progressPoints,
            currentPod: existingPod
          }
        });
      }
    }

    const { selectedSkills, personality } = user;
    const skillToJoin = selectedSkills[0];

    // Find existing pod or create new one
    let pod = await Pod.findOne({
      skill: skillToJoin,
      isActive: true,
      $expr: { $lt: [{ $size: "$members" }, 6] }
    });

    if (!pod) {
      console.log('🆕 Creating new pod...');
      pod = new Pod({
        skill: skillToJoin,
        members: [user._id],
        isActive: true,
        analytics: {
          totalMessages: 0,
          lastActivity: null
        }
      });
      await pod.save();
      console.log('✅ New pod created:', pod._id);
    } else {
      console.log('✅ Adding user to existing pod:', pod._id);
      pod.members.push(user._id);
      await pod.save();
    }

    // Update user's current pod
    user.currentPod = pod._id;
    await user.save();

   const progress = await updateUserProgress(req.userId, messageType);
console.log('📈 Progress updated:', progress);
    res.json({
      success: true,
      message: 'Successfully joined pod',
      podId: pod._id,
      anonymousName: user.anonymousName,
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        anonymousName: updatedUser.anonymousName,
        selectedSkills: updatedUser.selectedSkills,
        progressPoints: updatedUser.progressPoints,
        currentPod: updatedUser.currentPod
      }
    });

  } catch (error) {
    console.error('❌ Pod join error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to join pod',
      error: error.message 
    });
  }
};

// 📤 Send message to pod (UPDATED)
const sendMessage = async (req, res) => {
  console.log('📍 sendMessage called');
  const { podId } = req.params;
  const { content, type } = req.body;

  if (!content) {
    return res.status(400).json({ 
      success: false,
      message: 'Content is required' 
    });
  }

  try {
    // ✅ ENSURE USER HAS ANONYMOUS NAME BEFORE SENDING MESSAGE
    await ensureAnonymousName(req.userId);

    // Verify pod exists
    const pod = await Pod.findById(podId);
    if (!pod) {
      return res.status(404).json({ 
        success: false,
        message: 'Pod not found' 
      });
    }

    // Check if user is member of the pod
    const isMember = pod.members.some(member => 
      member.toString() === req.userId
    );
    
    if (!isMember) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied: Not a member of this pod' 
      });
    }

    const validTypes = ['text', 'resource', 'feedback', 'reaction', 'checkin', 'milestone', 'progress'];
    const messageType = type && validTypes.includes(type) ? type : 'text';

    // Create and save message
    const message = new Message({
      podId,
      userId: req.userId,
      content,
      type: messageType
    });

    const savedMessage = await message.save();
    console.log('✅ Message saved:', savedMessage._id);

    // Update user's pod participation
    const user = await User.findById(req.userId);
    if (!user.podParticipation) {
      user.podParticipation = { messagesCount: 0, resourcesShared: 0 };
    }

    if (['text', 'progress', 'feedback', 'checkin', 'milestone'].includes(messageType)) {
      user.podParticipation.messagesCount += 1;
    }

    if (messageType === 'resource') {
      user.podParticipation.resourcesShared += 1;
    }

    await user.save();

    // Return response with anonymous name
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: savedMessage._id,
        podId: podId,
        content: content,
        type: messageType,
        timestamp: savedMessage.createdAt,
        anonymousName: user.anonymousName,
        author: {
          userId: user._id,
          anonymousName: user.anonymousName
        }
      }
    });

  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send message',
      error: error.message 
    });
  }
};

// 📖 Get messages for a pod (UPDATED)
const getMessages = async (req, res) => {
  console.log('📍 getMessages called');
  const { podId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  try {
    const pod = await Pod.findById(podId);
    if (!pod) {
      return res.status(404).json({ 
        success: false,
        message: 'Pod not found' 
      });
    }

    // Check if user is member of the pod
    const isMember = pod.members.some(member => 
      member.toString() === req.userId
    );
    
    if (!isMember) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied: Not a member of this pod' 
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // ✅ POPULATE WITH ANONYMOUS NAME
    const messages = await Message.find({ 
      podId, 
      isDeleted: false 
    })
    .populate('userId', 'anonymousName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const totalMessages = await Message.countDocuments({ 
      podId, 
      isDeleted: false 
    });

    console.log('✅ Found', messages.length, 'messages with anonymous names');

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMessages,
        hasMore: skip + messages.length < totalMessages
      }
    });

  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

// 📊 Get current user's pod info (NEW)
const getMyPod = async (req, res) => {
  try {
    console.log('📍 getMyPod called for user:', req.userId);
    
    // ✅ ENSURE USER HAS ANONYMOUS NAME
    await ensureAnonymousName(req.userId);
    
    const user = await User.findById(req.userId).populate('currentPod');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (!user.currentPod) {
      return res.status(404).json({ 
        success: false,
        message: 'No pod found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        anonymousName: user.anonymousName,
        selectedSkills: user.selectedSkills,
        progressPoints: user.progressPoints,
        currentPod: user.currentPod
      }
    });

  } catch (error) {
    console.error('❌ Get my pod error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching pod',
      error: error.message 
    });
  }
};

module.exports = {
  joinPod,
  sendMessage,
  getMessages,
  getMyPod,
  generateAnonymousName,
  ensureAnonymousName
};

// ============================================
// 2. UPDATE YOUR User.js MODEL (if needed)
// ============================================

/*
// Make sure your User model has the anonymousName field:

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  anonymousName: { type: String, default: null }, // ← MAKE SURE THIS EXISTS
  selectedSkills: [{ type: String }],
  progressPoints: { type: Number, default: 0 },
  currentPod: { type: mongoose.Schema.Types.ObjectId, ref: 'Pod' },
  podParticipation: {
    messagesCount: { type: Number, default: 0 },
    resourcesShared: { type: Number, default: 0 }
  },
  personality: {
    learningStyle: String,
    motivation: String,
    timeCommitment: String
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
*/