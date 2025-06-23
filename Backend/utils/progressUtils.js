const User = require('../models/User');

async function updateUserProgress(userId, type) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Weekly progress reset check
    const now = new Date();
    if (now > user.nextWeeklyReset) {
      user.progress = {
        messages: 0,
        resources: 0,
        points: 0
      };
      user.nextWeeklyReset = new Date(now);
      user.nextWeeklyReset.setDate(now.getDate() + 7);
    }

    let points = 0;
    let messageIncrement = 0;
    let resourceIncrement = 0;

    switch (type) {
      case 'text':
      case 'feedback':
      case 'checkin':
      case 'milestone':
      case 'progress':
        points = 1;
        messageIncrement = 1;
        break;
      case 'resource':
        points = 3;
        resourceIncrement = 1;
        break;
        case 'feedbackReceived':
        points = 2; // Receiver gets 2 points
        break;
      case 'reaction':
        points = 2;
        break;
      default:
        points = 1;
        messageIncrement = 1;
    }

    // Update progress fields
    user.progress.messages += messageIncrement;
    user.progress.resources += resourceIncrement;
    user.progress.points += points;

    // Update pod participation
    if (!user.podParticipation) {
      user.podParticipation = { messagesCount: 0, resourcesShared: 0 };
    }
    user.podParticipation.messagesCount += messageIncrement;
    user.podParticipation.resourcesShared += resourceIncrement;

    await user.save();
    return user.progress;
  } catch (error) {
    console.error('Progress update error:', error);
    throw error;
  }
}

module.exports = { updateUserProgress }; // Renamed from updateProgressPoints