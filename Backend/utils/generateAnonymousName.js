// utils/generateAnonymousName.js
const adjectives = ['Sky', 'Ocean', 'Star', 'Moon', 'Sun', 'Cloud', 'Dream', 'Fire', 'Wind', 'Stone', 'Shiny', 'Bold'];
const nouns = ['Walker', 'Seeker', 'Rider', 'Hunter', 'Thinker', 'Flier', 'Coder', 'Builder', 'Creator', 'Explorer'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAnonymousName(existingNames = new Set()) {
  let name;
  let attempts = 0;

  do {
    name = `${getRandomElement(adjectives)}${getRandomElement(nouns)}_${Math.floor(100 + Math.random() * 900)}`;
    attempts++;
    if (attempts > 50) break; // Avoid infinite loop
  } while (existingNames.has(name));

  return name;
}

module.exports = generateAnonymousName;
