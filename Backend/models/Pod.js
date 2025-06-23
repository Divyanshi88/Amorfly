const mongoose = require('mongoose');

const podSchema = new mongoose.Schema({
  skill: { type: String, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // ✅ Ensure this line exists
  personalitySummary: {
    learningStyle: String,
    motivation: String,
    timeCommitment: String
  },
  isActive: { type: Boolean, default: true },
  analytics: {
    totalMessages: { type: Number, default: 0 },
    lastActivity: { type: Date, default: null }
  }
});

module.exports = mongoose.model('Pod', podSchema);
