// createbot.js
// Usage: node createbot.js LEGION 5 android|windows (or both if not specified)

const fs = require('fs');
const path = require('path');
const { FingerprintGenerator } = require('fingerprint-generator');

const ANDROID_MODELS = require('./Component/json/android.json').android;
const WINDOWS_MODELS = require('./Component/json/windows.json').windows;

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePersonality(deviceType, model) {
  // Generate a random fingerprint for the model
  const fingerprintGenerator = new FingerprintGenerator({
    devices: [deviceType === 'android' ? 'mobile' : 'desktop'],
    browsers: [{ name: 'chrome', minVersion: 88 }],
    operatingSystems: [deviceType === 'android' ? 'android' : 'windows']
  });
  const { fingerprint } = fingerprintGenerator.getFingerprint({ userAgent: model.userAgent });
  return {
    name: `${model.model.replace(/\s+/g, '_')}_${Date.now()}_${Math.floor(Math.random()*10000)}`,
    deviceType,
    model: model.model,
    userAgent: model.userAgent,
    screenResolution: model.screenResolution,
    fingerprint
  };
}

const deviceTypes = process.argv[4] ? [process.argv[4]] : ['android', 'windows'];

function createBots(family, quantity, deviceTypes) {
  const botsDir = path.resolve(__dirname, 'Component', 'bots', family);
  if (!fs.existsSync(botsDir)) fs.mkdirSync(botsDir, { recursive: true });
  // Count existing bots for prefixing
  const existing = fs.readdirSync(botsDir).filter(f => f.endsWith('.json')).length;
  let botIndex = existing + 1;
  const allBots = [];
  for (const deviceType of deviceTypes) {
    const models = deviceType === 'android' ? ANDROID_MODELS : WINDOWS_MODELS;
    for (let i = 0; i < quantity; i++) {
      const model = getRandomItem(models);
      const personality = generatePersonality(deviceType, model);
      // Prefix bot name with family and zero-padded number
      const botNum = String(botIndex).padStart(3, '0');
      personality.name = `${family}_${botNum}`;
      const botFile = path.join(botsDir, `${personality.name}.json`);
      fs.writeFileSync(botFile, JSON.stringify(personality, null, 2));
      allBots.push(personality);
      botIndex++;
    }
  }
  console.log(`Created ${allBots.length} bots for family '${family}' in ${botsDir}`);
}

// CLI usage: node createbot.js LEGION 5
if (require.main === module) {
  const [,, family, quantity] = process.argv;
  if (!family || !quantity || isNaN(Number(quantity))) {
    console.log('Usage: node createbot.js <FAMILY_NAME> <QUANTITY> [android|windows]');
    process.exit(1);
  }
  createBots(family, Number(quantity), deviceTypes);
}
