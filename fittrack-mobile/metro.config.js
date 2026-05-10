const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared packages directory
config.watchFolders = [workspaceRoot];

// Resolve @fittrack/core to the local package
config.resolver.extraNodeModules = {
  '@fittrack/core': path.resolve(workspaceRoot, 'packages/core'),
};

module.exports = config;
