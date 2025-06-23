// utils/connectionUtils.js
const User = require('../models/User');

/**
 * Determines if a user is eligible to unlock a 1:1 connection
 * based on engagement and cooldown period.
 * 
 * @param {string} userId - The ID of the user to check
 * @returns {boolean} - Whether the user can unlock a 1:1 connection
 */
exports.canUnlockConnection = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.currentPod) return false;

    const progressPoints = user.progressPoints || 0;
    const hasSufficientPoints = progressPoints >= 3;

    const now = new Date();
    const last = user.last1on1Connection || new Date(0); // If null, assume they never connected
    const daysSinceLast = (now - last) / (1000 * 60 * 60 * 24);
    const cooldownPassed = daysSinceLast >= 7;

    return hasSufficientPoints && cooldownPassed;
  } catch (error) {
    console.error('🔴 Error in canUnlockConnection:', error.message);
    return false;
  }
};
