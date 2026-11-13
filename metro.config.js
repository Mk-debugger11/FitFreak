const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');

// Force every `three` import/require (including CJS packages like @react-three/fiber)
// onto the ESM build so Hermes never executes three.cjs's `process.emitWarning` call
// and only one Three.js instance exists in the bundle.
const threeModulePath = path.resolve(__dirname, 'node_modules/three/build/three.module.js');
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return {
      filePath: threeModulePath,
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
