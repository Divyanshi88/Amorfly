// utils/podUtils.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Pod = require('../models/Pod');

// Helper function to calculate personality match score
function personalityMatchScore(userP, podP) {
  let score = 0;
  if (userP.learningStyle === podP.learningStyle) score += 0.4;
  if (userP.motivation === podP.motivation) score += 0.35;
  if (userP.timeCommitment === podP.timeCommitment) score += 0.25;
  return score;
}

// Main pod assignment function
exports.assignUserToPod = async (userId) => {
  try {
    // Validate userId format
    if (!mongoose.isValidObjectId(userId)) {
      throw new Error('Invalid user ID format');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already in a pod
    const existingPod = await Pod.findOne({ members: userId });
    if (existingPod) {
      return { 
        success: true, 
        pod: existingPod,
        message: 'User already in a pod',
        isNew: false
      };
    }

    const primarySkill = user.selectedSkills[0];
    const personality = user.personality;

    // Find candidate pods with capacity and matching skill
    const candidatePods = await Pod.find({
      skill: primarySkill,
      $expr: { $lt: [{ $size: "$members" }, 6] } // Max 5 members (0-5 index)
    }).lean();

    // Find best matching pod
    let bestMatch = null;
    let bestScore = 0.5; // Minimum threshold

    for (const pod of candidatePods) {
      // Skip if user is already in this pod (extra safety)
      if (pod.members.some(m => m.toString() === userId.toString())) {
        continue;
      }

      const score = personalityMatchScore(personality, pod.personalitySummary);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pod;
      }
    }

    let pod;
    if (bestMatch) {
      // Add to existing pod
      pod = await Pod.findByIdAndUpdate(
        bestMatch._id,
        { 
          $addToSet: { members: userId }, // Using $addToSet prevents duplicates
          $setOnInsert: { personalitySummary: personality }
        },
        { new: true }
      );
    } else {
      // Create new pod
      pod = new Pod({
        skill: primarySkill,
        personalitySummary: personality,
        members: [userId],
        createdAt: new Date()
      });
      await pod.save();
    }

    // Update user's current pod reference
    user.currentPod = pod._id;
    await user.save();

    return { 
      success: true, 
      pod,
      isNew: !bestMatch,
      matchScore: bestMatch ? bestScore : null
    };

  } catch (error) {
    console.error('Error in assignUserToPod:', error);
    throw error; // Rethrow for route handler to catch
  }
};

// Additional utility to clean existing duplicates (one-time use)
exports.cleanDuplicateMembers = async () => {
  const pods = await Pod.find();
  let cleanedCount = 0;

  for (const pod of pods) {
    const uniqueMembers = [...new Set(pod.members.map(m => m.toString()))];
    if (uniqueMembers.length !== pod.members.length) {
      pod.members = uniqueMembers;
      await pod.save();
      cleanedCount++;
    }
  }

  return { cleanedCount };
};