const express = require('express');
const router = express.Router();

const { updateUserProgress } = require('../utils/progressUtils');
const User = require('../models/User');

// Predefined skills list
const availableSkills = [
  // Music
  'Guitar', 'Piano', 'Singing', 'Music Production', 'Drums',
  
  // Tech
  'Programming', 'Web Development', 'Mobile Development', 'Data Science', 'AI/ML',
  
  // Arts & Crafts
  'Drawing', 'Painting', 'Photography', 'Graphic Design', 'Writing',
  
  // Lifestyle
  'Cooking', 'Fitness', 'Meditation', 'Yoga', 'Gardening',
  
  // Languages
  'Spanish', 'French', 'German', 'Japanese', 'English',
  
  // Business
  'Public Speaking', 'Leadership', 'Marketing', 'Entrepreneurship', 'Finance',
  
  // Other
  'Chess', 'Dancing', 'Gaming', 'Reading', 'Traveling'
];

// Get all available skills
router.get('/', (req, res) => {
  try {
    res.json({
      skills: availableSkills.sort(),
      total: availableSkills.length
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get skills by category
router.get('/categories', (req, res) => {
  try {
    const categorizedSkills = {
      'Music': ['Guitar', 'Piano', 'Singing', 'Music Production', 'Drums'],
      'Technology': ['Programming', 'Web Development', 'Mobile Development', 'Data Science', 'AI/ML'],
      'Arts & Crafts': ['Drawing', 'Painting', 'Photography', 'Graphic Design', 'Writing'],
      'Lifestyle': ['Cooking', 'Fitness', 'Meditation', 'Yoga', 'Gardening'],
      'Languages': ['Spanish', 'French', 'German', 'Japanese', 'English'],
      'Business': ['Public Speaking', 'Leadership', 'Marketing', 'Entrepreneurship', 'Finance'],
      'Other': ['Chess', 'Dancing', 'Gaming', 'Reading', 'Traveling']
    };

    res.json(categorizedSkills);
  } catch (error) {
    console.error('Get categorized skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search skills
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.json({ skills: availableSkills.sort() });
    }

    const searchTerm = q.toLowerCase();
    const filteredSkills = availableSkills.filter(skill => 
      skill.toLowerCase().includes(searchTerm)
    );

    res.json({
      skills: filteredSkills.sort(),
      searchTerm: q,
      total: filteredSkills.length
    });
  } catch (error) {
    console.error('Search skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/share', async (req, res) => {
  try {
    const { userId } = req; // Assuming you have authentication middleware
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update progress
    const progress = await updateUserProgress(userId, 'resource');
    
    res.json({
      success: true,
      message: 'Resource shared successfully',
      progress
    });
  } catch (error) {
    console.error('Resource share error:', error);
    res.status(500).json({ message: 'Failed to share resource' });
  }
});

module.exports = router;