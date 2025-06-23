const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  isAnonymous: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const connectionSchema = new mongoose.Schema({
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  sharedSkill: String,
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
  evaluationPeriod: {
    startDate: Date,
    endDate: Date
  },
  feedback: [feedbackSchema] // ✅ Add this
});

module.exports = mongoose.model('Connection', connectionSchema);