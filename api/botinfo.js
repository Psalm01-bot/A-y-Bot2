// api/botinfo.js
// Returns available bot families and bot counts
const fs = require('fs');
const path = require('path');

function getBotInfo() {
  const botsDir = path.join(__dirname, '..', 'Component', 'bots');
  const info = {
    families: [],
    total: 0,
    android: 0,
    windows: 0
  };
  if (fs.existsSync(botsDir)) {
    fs.readdirSync(botsDir).forEach(family => {
      const familyDir = path.join(botsDir, family);
      if (fs.statSync(familyDir).isDirectory()) {
        const files = fs.readdirSync(familyDir).filter(f => f.endsWith('.json'));
        if (files.length > 0) {
          info.families.push(family);
          files.forEach(file => {
            try {
              const bot = JSON.parse(fs.readFileSync(path.join(familyDir, file), 'utf-8'));
              info.total++;
              if (bot.deviceType === 'android') info.android++;
              if (bot.deviceType === 'windows') info.windows++;
            } catch (e) {
              console.warn(`Warning: Skipping corrupted bot file: ${file} (${e.message})`);
            }
          });
        }
      }
    });
  }
  return info;
}

module.exports = getBotInfo;
