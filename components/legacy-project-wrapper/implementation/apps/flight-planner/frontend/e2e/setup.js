const { execSync } = require('child_process');

module.exports = async () => {
  // Setup simulator
  console.log('Setting up simulator...');
  execSync('npm run start-simulator');
};