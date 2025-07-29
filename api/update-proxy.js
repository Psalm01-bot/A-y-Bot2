const fs = require('fs');
const path = require('path');
const axios = require('axios');

const PROXY_URL = 'https://raw.githubusercontent.com/Psalm01-bot/proxy-json/refs/heads/main/proxy-list.json';
//https://raw.githubusercontent.com/Psalm01-bot/proxy-json/refs/heads/main/proxy-list.json
//https://raw.githubusercontent.com/Psalm01-bot/proxy-json/main/proxy-list.json
const LOCAL_PATH = path.join(__dirname, '../proxy.json');

async function updateProxyFile() {
  try {
    console.log(`[Updater] 🔍 Checking for proxy list updates...`);

    // 1. Fetch remote proxy list
    const response = await axios.get(PROXY_URL, { timeout: 10000 });
    const newData = JSON.stringify(response.data, null, 2);

    // 2. Check if local proxy.json exists
    if (fs.existsSync(LOCAL_PATH)) {
      const currentData = fs.readFileSync(LOCAL_PATH, 'utf-8');

      // 3. Compare current with new
      if (currentData.trim() === newData.trim()) {
        console.log(`[Updater] ✅ proxy.json is already up to date. No changes needed.`);
        return;
      }
    }

    // 4. Overwrite if different or file doesn't exist
    fs.writeFileSync(LOCAL_PATH, newData);
    console.log(`[Updater] 🚀 proxy.json updated from GitHub.`);
  } catch (error) {
    console.error(`[Updater] ❌ Failed to update proxy.json:`, error.message);
  }
}

module.exports = updateProxyFile;
