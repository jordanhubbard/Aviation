const { execSync } = require('child_process');

module.exports = async () => {
  // Teardown simulator
  console.log('Tearing down simulator...');
  execSync('npm run stop-simulator');
};