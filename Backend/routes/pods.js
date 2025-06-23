const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); // Add this import

const { assignUserToPod } = require('../utils/podUtils');
const generateAnonymousName = require('../utils/generateAnonymousName');
const { updateUserProgress } = require('../utils/progressUtils');


// Import models with proper error handling
let User, Pod, Message;
try {
  User = require('../models/User');
  Pod = require('../models/Pod');
  Message = require('../models/Message');
  console.log('✅ Models imported successfully');
  
  // Verify all models are loaded
  if (!User || !Pod || !Message) {
    throw new Error('One or more models failed to load');
  }
} catch (error) {
  console.error('❌ Error importing models:', error.message);
  console.error('❌ Stack trace:', error.stack);
  process.exit(1); // Exit if models can't be loaded
}

const router = express.Router();
console.log('🔧 Creating pods router...');

// 🔍 Debug middleware to log all router requests
router.use((req, res, next) => {
  console.log('🎯 Pods router received:', req.method, req.path);
  console.log('🎯 Full original URL:', req.originalUrl);
  next();
});

// 🛡️ Auth middleware
const authMiddleware = (req, res, next) => {
  console.log('🔐 Auth middleware called for:', req.method, req.path);

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

// 🎭 Helper function to ensure user has anonymous name
const ensureAnonymousName = async (userId, pod = null) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.anonymousName) {
      // Fetch all current anonymous names in the pod (if any pod was found)
      let existingNames = new Set();

      if (pod) {
        const existingUsers = await User.find({ _id: { $in: pod.members } }).select('anonymousName');
        existingUsers.forEach(u => u.anonymousName && existingNames.add(u.anonymousName));
      }

      // Generate a unique name
      user.anonymousName = generateAnonymousName(existingNames);
      await user.save();
      console.log('🔐 Unique anonymous name assigned:', user.anonymousName);
    }

    return user.anonymousName;
  } catch (error) {
    console.error('❌ Error ensuring anonymous name:', error);
    throw error;
  }
};

// 🚪 POST /join - Join or create a pod
router.post('/join', authMiddleware, async (req, res) => {
  console.log('📍 POST /join called');
  console.log('🔍 Raw URL:', req.originalUrl);
  console.log('🔍 Clean URL:', req.url);
  
  try {
    console.log('🔍 Processing pod join request for user:', req.userId);
    
    // Check if assignUserToPod function exists
    if (typeof assignUserToPod !== 'function') {
      console.error('❌ assignUserToPod is not a function:', typeof assignUserToPod);
      throw new Error('assignUserToPod utility function not available');
    }
    
    console.log('🔧 Calling assignUserToPod...');
    const result = await assignUserToPod(req.userId);
    console.log('🔍 assignUserToPod result:', result);
    console.log('🔍 Result type:', typeof result);
    
    // Handle if assignUserToPod returns a podId directly
    let pod;
    if (typeof result === 'string' || result instanceof mongoose.Types.ObjectId) {
      console.log('🔍 assignUserToPod returned podId directly, fetching pod...');
      pod = await Pod.findById(result);
      if (!pod) {
        throw new Error('Pod not found after assignment');
      }
    } else if (result && result.success && result.pod) {
      // Handle expected object format
      pod = result.pod;
    } else if (result && result._id) {
      // Handle if pod object returned directly
      pod = result;
    } else {
      console.log('❌ Unexpected result format from assignUserToPod');
      throw new Error('Failed to get pod from assignUserToPod');
    }
    
    console.log('🎯 Pod found/created:', pod._id);
    
    // 🎭 Ensure user has anonymous name for this pod
    console.log('🎭 Ensuring anonymous name...');
    await ensureAnonymousName(req.userId, pod);
    console.log('✅ Anonymous name ensured');
    
    console.log('✅ User successfully joined pod:', pod._id);
    
    res.json({
      success: true,
      message: 'Successfully joined pod',
      data: {
        podId: pod._id,
        podName: pod.name,
        memberCount: pod.members.length,
        maxMembers: pod.maxMembers || 8
      }
    });

  } catch (error) {
    console.error('❌ Error in POST /join:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false, 
      message: 'Failed to join pod',
      error: error.message
    });
  }
});

// 📖 Get messages for a pod
router.get('/:podId/messages', authMiddleware, async (req, res) => {
  console.log('📍 GET /:podId/messages called');
  const { podId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  try {
    console.log('🔍 Fetching pod:', podId);
    const pod = await Pod.findById(podId);

    if (!pod || !Array.isArray(pod.members)) {
      return res.status(404).json({
        success: false,
        message: 'Pod not found or members not initialized'
      });
    }

    // ✅ Check membership safely
    const isMember = pod.members.some(
      member => member?.toString() === req.userId
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this pod'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({
      podId,
      isDeleted: false
    })
      .populate('userId', 'anonymousName') // Only show anonymousName
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await Message.countDocuments({
      podId,
      isDeleted: false
    });

    console.log(`✅ Found ${messages.length} messages for pod ${podId}`);

    res.json({
      success: true,
      messages: messages.reverse(), // oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMessages,
        hasMore: skip + messages.length < totalMessages
      }
    });

  } catch (error) {
    console.error('❌ Error fetching messages:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pod messages',
      error: error.message
    });
  }
});

// 📬 POST message to a pod
router.post('/:podId/messages', authMiddleware, async (req, res) => {
  console.log('📍 POST /:podId/messages called');
  const { podId } = req.params;
  const { content, type } = req.body;

  if (!content) {
    return res.status(400).json({ 
      success: false,
      message: 'Content is required' 
    });
  }

  try {
    // Check if Message model is available
    if (!Message) {
      console.error('❌ Message model is not available');
      throw new Error('Message model is not available');
    }

    // Verify pod exists and user is a member
    const pod = await Pod.findById(podId);
    if (!pod) {
      return res.status(404).json({ 
        success: false,
        message: 'Pod not found' 
      });
    }

    const isMember = pod.members.some(member => 
      member.toString() === req.userId
    );
    
    if (!isMember) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied: Not a member of this pod' 
      });
    }

    // 🎭 Ensure user has anonymous name before posting
    await ensureAnonymousName(req.userId, pod);

    // Validate message type
    const validTypes = ['text', 'resource', 'feedback', 'reaction', 'checkin', 'milestone', 'progress'];
    const messageType = type && validTypes.includes(type) ? type : 'text';

    console.log('🔍 Creating new message with:', { podId, userId: req.userId, content, type: messageType });

    const messageData = {
      podId,
      userId: req.userId,
      content,
      type: messageType
    };
console.log('🏗️ Creating message instance...');
const message = new Message(messageData);

console.log('💾 Saving message to database...');
const savedMessage = await message.save();
console.log('✅ Message saved successfully:', savedMessage._id);

// ✅ Update pod's last activity
await Pod.findByIdAndUpdate(podId, {
  'analytics.lastActivity': new Date()
});
console.log('📅 Last activity updated for pod:', podId);

    // 🧠 Update progress points based on message type
    console.log('📈 Updating progress points...');
    try {
      await updateUserProgress(req.userId, messageType);
      console.log('✅ Progress points updated');
    } catch (progressError) {
      console.error('⚠️ Error updating progress points:', progressError.message);
    }

    // ✅ Update podParticipation
    console.log('📊 Updating pod participation...');
    try {
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
      console.log('✅ podParticipation updated:', user.podParticipation);
    } catch (engageErr) {
      console.error('⚠️ Could not update engagement stats:', engageErr.message);
    }

    // 📤 Return response with user's anonymous name
    const userWithName = await User.findById(req.userId).select('anonymousName');
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: savedMessage._id,
        podId: podId,
        content: content,
        type: messageType,
        timestamp: savedMessage.createdAt,
        anonymousName: userWithName.anonymousName
      }
    });
  } catch (error) {
    console.error('❌ Error in POST /:podId/messages:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to create message'
    });
  }
});
// ✨ Give feedback to another user
router.post('/:podId/feedback', authMiddleware, async (req, res) => {
  const { podId } = req.params;
  const { toUserId, feedback } = req.body;

  if (!toUserId || !feedback) {
    return res.status(400).json({ success: false, message: 'Recipient and feedback message are required.' });
  }

  try {
    // ✅ Check if pod exists and user is a member
    const pod = await Pod.findById(podId);
    if (!pod) {
      return res.status(404).json({ success: false, message: 'Pod not found.' });
    }

    const isMember = pod.members.some(member => member.toString() === req.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this pod.' });
    }

    // ✅ Check if recipient is in the same pod
    const isRecipientMember = pod.members.some(member => member.toString() === toUserId);
    if (!isRecipientMember) {
      return res.status(403).json({ success: false, message: 'Recipient is not a member of this pod.' });
    }

    // ✅ Increment feedback count and save feedback history
    const recipient = await User.findById(toUserId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient user not found.' });
    }

    recipient.feedbackReceived += 1;

    // 📝 Save feedback to recipient's history
    recipient.feedbackHistory.push({
      fromUserId: req.userId,
      feedbackMessage: feedback
    });

    await recipient.save();

    // ✅ Update progress points for sender and receiver
    await updateUserProgress(req.userId, 'feedback'); // Giver gets points
    await updateUserProgress(toUserId, 'feedback');   // Receiver gets points

    console.log(`✅ Feedback given by ${req.userId} to ${toUserId}: ${feedback}`);

    res.json({
      success: true,
      message: 'Feedback given successfully.',
      feedbackGivenTo: toUserId,
      newFeedbackCount: recipient.feedbackReceived
    });

  } catch (error) {
    console.error('❌ Error giving feedback:', error);
    res.status(500).json({ success: false, message: 'Failed to give feedback.', error: error.message });
  }
});
// 📜 GET Feedback History
router.get('/:podId/feedback-history/:userId', authMiddleware, async (req, res) => {
  const { podId, userId } = req.params;

  try {
    // ✅ Check if pod exists and the requesting user is a member
    const pod = await Pod.findById(podId);
    if (!pod) {
      return res.status(404).json({ success: false, message: 'Pod not found.' });
    }

    const isMember = pod.members.some(member => member.toString() === req.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this pod.' });
    }

    // ✅ Check if the target user is in the pod
    const isTargetMember = pod.members.some(member => member.toString() === userId);
    if (!isTargetMember) {
      return res.status(403).json({ success: false, message: 'Target user is not in this pod.' });
    }

    // ✅ Get the target user with feedback history
    const targetUser = await User.findById(userId).populate('feedbackHistory.fromUserId', 'anonymousName');

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      message: 'Feedback history fetched successfully.',
      feedbackHistory: targetUser.feedbackHistory
    });

  } catch (error) {
    console.error('❌ Error fetching feedback history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback history.', error: error.message });
  }
});
// 📊 User Analytics API
router.get('/analytics/me', authMiddleware, async (req, res) => {
  try {
    // ✅ Find the current user
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      message: 'User analytics fetched successfully.',
      analytics: {
        progressPoints: user.progress?.points || 0,
        messagesSent: user.progress?.messages || 0,
        resourcesShared: user.progress?.resources || 0,
        feedbackReceived: user.feedbackReceived || 0,
        weeklyConnectionsLeft: user.weeklyConnectionsLeft || 0,
        nextWeeklyReset: user.nextWeeklyReset
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user analytics.', error: error.message });
  }
});
// 📊 Pod Analytics API
router.get('/:podId/analytics', authMiddleware, async (req, res) => {
  const { podId } = req.params;

  try {
    // ✅ Find the pod
    const pod = await Pod.findById(podId);
    if (!pod) {
      return res.status(404).json({ success: false, message: 'Pod not found.' });
    }

    // ✅ Check if user is a member of the pod
    const isMember = pod.members.some(member => member.toString() === req.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this pod.' });
    }

    // ✅ Count total messages in the pod
    const totalMessages = await Message.countDocuments({ podId, isDeleted: { $ne: true } });

    // ✅ Count total resources shared in the pod
    const totalResources = await Message.countDocuments({ podId, type: 'resource', isDeleted: { $ne: true } });
    // 📅 Calculate start of the week (7 days ago)
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

// 🔍 Messages sent in the last 7 days
const messagesLast7Days = await Message.countDocuments({
  podId,
  isDeleted: false,
  createdAt: { $gte: sevenDaysAgo }
});

// 🔍 Resources shared in the last 7 days
const resourcesLast7Days = await Message.countDocuments({
  podId,
  isDeleted: false,
  type: 'resource',
  createdAt: { $gte: sevenDaysAgo }
});

    // ✅ Count total feedback exchanges in this pod (Optional: can extend later)
    let totalFeedback = 0;
    const users = await User.find({ currentPod: podId });
    users.forEach(user => {
      totalFeedback += user.feedbackHistory ? user.feedbackHistory.length : 0;
    });

    res.json({
  success: true,
  message: 'Pod analytics fetched successfully.',
  analytics: {
    totalMembers: pod.members.length,
    totalMessages,
    totalResources,
    totalFeedback: 0, // Or your tracked feedback count
    lastActivity: pod.analytics?.lastActivity || null,
    messagesLast7Days,
    resourcesLast7Days
  }
});


  } catch (error) {
    console.error('❌ Error fetching pod analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pod analytics.', error: error.message });
  }
});


// 🚀 Get current pod of the logged-in user
router.get('/my-pod', authMiddleware, async (req, res) => {
  try {
    console.log('📍 GET /my-pod called for user:', req.userId);

    const user = await User.findById(req.userId);
    if (!user || !user.currentPod) {
      return res.status(404).json({
        success: false,
        message: 'No pod found for this user'
      });
    }

    const pod = await Pod.findById(user.currentPod).populate('members', 'anonymousName');
    if (!pod) {
      return res.status(404).json({
        success: false,
        message: 'Pod not found'
      });
    }

    console.log('✅ Found pod for user:', pod._id);

    res.json({
      success: true,
      pod: pod
    });

  } catch (error) {
    console.error('❌ Error fetching pod:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pod',
      error: error.message
    });
  }
});


// 🔐 Test route with auth
router.get('/test-auth', authMiddleware, (req, res) => {
  console.log('📍 GET /test-auth called with user:', req.userId);
  res.json({
    message: 'Auth is working!',
    userId: req.userId,
    timestamp: new Date()
  });
});

// 🧪 Test route to verify router is working
router.get('/test', (req, res) => {
  console.log('📍 GET /test called');
  res.json({
    message: 'Pod router is working!',
    timestamp: new Date(),
    endpoints: [
      'POST /api/pods/join - Join or create a pod',
      'GET /api/pods/:podId/messages - Get messages for a pod',
      'POST /api/pods/:podId/messages - Send message to a pod',
      'GET /api/pods/test - Test endpoint',
      'GET /api/pods/health - Health check'
    ]
  });
});

// 🩺 Health check for this router
router.get('/health', (req, res) => {
  console.log('📍 GET /health called');
  res.json({
    status: 'healthy',
    router: 'pods',
    timestamp: new Date()
  });
});

console.log('✅ Pods router with Anonymous Names, GET, POST, and Progress Points added');

module.exports = router;