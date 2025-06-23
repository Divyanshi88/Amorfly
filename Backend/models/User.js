const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  selectedSkills: [String],

  personality: {
    learningStyle: String,
    motivation: String,
    timeCommitment: String
  },

  anonymousName: String,
  engagementPoints: { type: Number, default: 0 },

  // ✅ Tracks progress points
  progressPoints: { type: Number, default: 0 },

  feedbackReceived: { type: Number, default: 0 },

  // ✅ Tracks how many messages/resources user has posted
  podParticipation: {
    messagesCount: { type: Number, default: 0 },
    resourcesShared: { type: Number, default: 0 }
  },

  // ✅ Current Pod user belongs to
  currentPod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pod'
  },

  // ✅ 1:1 connection system support
  last1on1Connection: {
    type: Date,
    default: null
  },
  connectionUnlocked: {
    type: Boolean,
    default: false
  },

  // ✅ Tracks weekly progress
  progress: {
    messages: { type: Number, default: 0 },
    resources: { type: Number, default: 0 },
    points: { type: Number, default: 0 }
  },

  // ✅ Weekly reset tracking
  nextWeeklyReset: {
    type: Date,
    default: () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }
  },

  // ✅ New: Feedback history storage
  feedbackHistory: [
    {
      fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      feedbackMessage: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model('User', UserSchema);
