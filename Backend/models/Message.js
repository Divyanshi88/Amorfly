// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  podId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pod',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'resource', 'feedback', 'reaction', 'checkin', 'milestone', 'progress'],
    default: 'text'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['like', 'love', 'support', 'celebrate']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
messageSchema.index({ podId: 1, createdAt: -1 });
messageSchema.index({ userId: 1 });

module.exports = mongoose.model('Message', messageSchema);