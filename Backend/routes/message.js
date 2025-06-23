const express = require('express');
const User = require('../models/User');
const Pod = require('../models/Pod');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
const { updateProgress } = require('../utils/progressUtils');

const router = express.Router();

// 🛡️ Auth middleware
const authMiddleware = (req, res, next) => {
  console.log('🔐 Auth middleware called for messages:', req.method, req.path);
  
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'amorfly_secret');
    req.userId = decoded.userId;
    console.log('✅ Auth successful for user:', req.userId);
    next();
  } catch (error) {
    console.log('❌ Auth failed:', error.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// 🧠 Compatibility Scoring
const calculateCompatibilityScore = (user, pod) => {
  if (pod.members.length === 0) return 1.0;

  let totalScore = 0;
  let validMembers = 0;

  for (const member of pod.members) {
    if (!member.userId || !member.userId.personality) continue;

    const memberP = member.userId.personality;
    const userP = user.personality;
    let score = 0;

    if (userP.learningStyle === memberP.learningStyle) score += 0.4;
    else if (
      (userP.learningStyle === 'visual' && memberP.learningStyle === 'reading') ||
      (userP.learningStyle === 'reading' && memberP.learningStyle === 'visual')
    ) score += 0.2;

    if (userP.motivation === memberP.motivation) score += 0.35;
    else if (userP.motivation === 'collaborative' && memberP.motivation !== 'competitive') score += 0.15;

    const commitment = { casual: 1, regular: 2, intensive: 3 };
    if (userP.timeCommitment === memberP.timeCommitment) score += 0.25;
    else if (Math.abs(commitment[userP.timeCommitment] - commitment[memberP.timeCommitment]) === 1) score += 0.1;

    totalScore += score;
    validMembers++;
  }

  return validMembers > 0 ? totalScore / validMembers : 1.0;
};

// 🔁 Find or Create Pod
const findOrCreatePod = async (userId) => {
  try {
    console.log('🔍 Finding or creating pod for user:', userId);
    
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.currentPod) {
      const existingPod = await Pod.findById(user.currentPod);
      if (existingPod && existingPod.isActive) {
        console.log('✅ User already has active pod:', existingPod._id);
        return existingPod;
      }
    }

    let bestPod = null;
    let bestScore = 0;

    for (const skill of user.selectedSkills) {
      const compatiblePods = await Pod.find({
        skill,
        isActive: true,
        $expr: { $lt: [{ $size: "$members" }, 6] }
      }).populate('members.userId');

      for (const pod of compatiblePods) {
        const score = calculateCompatibilityScore(user, pod);
        if (score > bestScore) {
          bestScore = score;
          bestPod = pod;
        }
      }

      if (bestPod && bestScore > 0.6) break;
    }

    if (bestPod && bestScore > 0.6) {
      console.log('✅ Found compatible pod:', bestPod._id, 'Score:', bestScore);
      
      bestPod.members.push({
        userId,
        joinedAt: new Date(),
        isActive: true
      });
      await bestPod.save();

      user.currentPod = bestPod._id;
      await user.save();

      return bestPod;
    }

    // Create a new pod if no match
    console.log('🆕 Creating new pod for user');
    const newPod = new Pod({
      skill: user.selectedSkills[0],
      members: [{
        userId,
        joinedAt: new Date(),
        isActive: true
      }],
      isActive: true
    });

    await newPod.save();
    user.currentPod = newPod._id;
    await user.save();

    console.log('✅ New pod created:', newPod._id);
    return newPod;

  } catch (error) {
    console.error('❌ Pod formation error:', error);
    throw error;
  }
};

// 🚀 Join a pod
router.post('/join-pod', authMiddleware, async (req, res) => {
  try {
    console.log('📍 POST /join-pod called for user:', req.userId);
    
    const pod = await findOrCreatePod(req.userId);
    const populatedPod = await Pod.findById(pod._id).populate('members.userId', 'anonymousName progressPoints');
    
    console.log('✅ Successfully joined/found pod');
    res.json({ 
      success: true,
      message: 'Successfully joined pod', 
      pod: populatedPod 
    });
  } catch (error) {
    console.error('❌ Join pod error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error joining pod',
      error: error.message 
    });
  }
});

// 🚀 Get current pod
router.get('/my-pod', authMiddleware, async (req, res) => {
  try {
    console.log('📍 GET /my-pod called for user:', req.userId);
    
    const user = await User.findById(req.userId);
    if (!user?.currentPod) {
      return res.status(404).json({ 
        success: false,
        message: 'No pod found' 
      });
    }

    const pod = await Pod.findById(user.currentPod).populate('members.userId', 'anonymousName progressPoints');
    if (!pod) {
      return res.status(404).json({ 
        success: false,
        message: 'Pod not found' 
      });
    }

    console.log('✅ Found user pod:', pod._id);
    res.json({
      success: true,
      pod: pod
    });
  } catch (error) {
    console.error('❌ Get pod error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching pod',
      error: error.message 
    });
  }
});

// ✉️ Post a message to a pod
router.post('/:podId/send', authMiddleware, async (req, res) => {
  console.log('📍 POST /:podId/send called');
  const { podId } = req.params;
  const { content, type } = req.body;

  if (!content) {
    return res.status(400).json({ 
      success: false,
      message: 'Content is required' 
    });
  }

  try {
    console.log('🔍 Checking if pod exists:', podId);
    const pod = await Pod.findById(podId);
    if (!pod) {
      return res.status(404).json({ 
        success: false,
        message: 'Pod not found' 
      });
    }

    console.log('💾 Creating new message...');
    const message = new Message({
      podId,
      userId: req.userId,
      content,
      type: type || 'text'
    });

    await message.save();
    console.log('✅ Message saved successfully:', message._id);

    // 🧠 Update progress points based on message type
    console.log('📈 Updating progress points...');
    await updateProgress(req.userId, type || 'text');
    console.log('✅ Progress points updated');

    // ✅ Update podParticipation
    console.log('📊 Updating pod participation...');
    const user = await User.findById(req.userId);
    if (!user.podParticipation) {
      user.podParticipation = { messagesCount: 0, resourcesShared: 0 };
    }
    
    const messageType = type || 'text';
    if (['text', 'progress'].includes(messageType)) {
      user.podParticipation.messagesCount += 1;
    }
    if (messageType === 'resource') {
      user.podParticipation.resourcesShared += 1;
    }
    
    await user.save();
    console.log('✅ podParticipation updated:', user.podParticipation);

    res.status(201).json({ 
      success: true,
      message: 'Message sent successfully', 
      data: {
        messageId: message._id,
        podId: podId,
        content: content,
        type: type || 'text',
        timestamp: message.createdAt
      }
    });
  } catch (err) {
    console.error('❌ Message post error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send message',
      error: err.message 
    });
  }
});

// 📖 Get messages for a pod
router.get('/:podId/messages', authMiddleware, async (req, res) => {
  console.log('📍 GET /:podId/messages called');
  const { podId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  try {
    console.log('🔍 Fetching messages for pod:', podId);
    
    const pod = await Pod.findById(podId);
    if (!pod) {
      return res.status(404).json({ 
        success: false,
        message: 'Pod not found' 
      });
    }

    // Check if user is member of the pod
    const isMember = pod.members.some(member => 
      member.userId.toString() === req.userId
    );
    
    if (!isMember) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied: Not a member of this pod' 
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
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

    console.log('✅ Found', messages.length, 'messages');

    res.json({
      success: true,
      messages: messages.reverse(), // Show oldest first
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
});

// 🧪 Test route
router.get('/test', (req, res) => {
  console.log('📍 GET /test called');
  res.json({
    message: 'Messages router is working!',
    timestamp: new Date(),
    endpoints: [
      'POST /api/messages/join-pod - Join or create a pod',
      'GET /api/messages/my-pod - Get current user pod',
      'POST /api/messages/:podId/send - Send message to pod',
      'GET /api/messages/:podId/messages - Get pod messages',
      'GET /api/messages/test - Test endpoint'
    ]
  });
});

console.log('✅ Messages router created with pod management and messaging');

module.exports = router;