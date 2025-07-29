// server.js
// Express backend for Bot Manager UI
const express = require('express');
const path = require('path');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const getBotInfo = require('./api/botinfo');
const WebSocket = require('ws');
const saveTask = require('./createtask');
const deleteTask = require('./api/deletetask');
const updateProxyFile = require('./api/update-proxy'); // adjust the path if needed


const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));
app.use('/tasks', express.static(path.join(__dirname, 'tasks')));
app.use('/image', express.static(path.join(__dirname, 'image')));

function scheduleProxyUpdates(intervalMs = 3 * 60 * 60 * 1000) {
  let timeLeft = intervalMs / 1000; // time left in seconds

  console.log('[Updater] ⏰ Scheduling proxy updates every 3 hours...');
  updateProxyFile();

  setInterval(() => {
    timeLeft--;

    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    // Live countdown in the same line
    process.stdout.write(
      `\r[Updater] ⏳ Next update in: ${hours}h ${minutes}m ${seconds}s     `
    );

    if (timeLeft <= 0) {
  console.log('\n[Updater] 🔄 Time reached. Fetching new proxy list...');
  updateProxyFile().then(() => {
    console.log(`[Updater] ✅ Update complete. Restarting countdown...`);
    timeLeft = intervalMs / 1000; // ⏳ Restart timer
  }).catch((err) => {
    console.warn(`[Updater] ⚠️ Update failed: ${err.message}. Retrying in ${intervalMs / 1000}s`);
    timeLeft = intervalMs / 1000; // Still restart the timer even if it failed
  });
}

  }, 1000);
}


scheduleProxyUpdates();



const runningBots = [];

// Track bot launch status
let botLaunchStatus = {
  pending: 0,
  running: 0,
  failed: 0,
  lastError: null
};

let nextWsPort = 9000;

// API: Create bots
app.post('/api/createbot', (req, res) => {
  const { familyName, androidCount, windowsCount } = req.body;
  if (!familyName || !androidCount || !windowsCount) {
    return res.json({ success: false, error: 'Missing required fields.' });
  }
  // Call createbot.js for each device type
  const total = Number(androidCount) + Number(windowsCount);
  let created = 0;
  let errors = [];
  function done() {
    if (created === 2) {
      if (errors.length === 0) {
        res.json({ success: true, count: total });
      } else {
        res.json({ success: false, error: errors.join('; ') });
      }
    }
  }
  execFile('node', ['createbot.js', familyName, androidCount, 'android'], (err) => {
    if (err) errors.push('Android: ' + err.message);
    created++;
    done();
  });
  execFile('node', ['createbot.js', familyName, windowsCount, 'windows'], (err) => {
    if (err) errors.push('Windows: ' + err.message);
    created++;
    done();
  });
});

// API: Launch bots
app.post('/api/launchbot', (req, res) => {
  const { launchFamilyName, androidCount, windowsCount, targetWebsite, useLocalNetwork } = req.body;
  const botsDir = path.join(__dirname, 'Component', 'bots');
  let botFiles = [];
  if (launchFamilyName) {
    const familyDir = path.join(botsDir, launchFamilyName);
    if (fs.existsSync(familyDir)) {
      botFiles = fs.readdirSync(familyDir).map(f => path.join(familyDir, f));
    }
  } else {
    if (fs.existsSync(botsDir)) {
      fs.readdirSync(botsDir).forEach(family => {
        const familyDir = path.join(botsDir, family);
        if (fs.statSync(familyDir).isDirectory()) {
          botFiles = botFiles.concat(fs.readdirSync(familyDir).map(f => path.join(familyDir, f)));
        }
      });
    }
  }
  if (botFiles.length === 0) {
    return res.json({ success: false, error: 'No bots found for the selected family.' });
  }
  // Separate bots by device type
  const androidBots = botFiles.filter(f => {
    try {
      return JSON.parse(fs.readFileSync(f, 'utf-8')).deviceType === 'android';
    } catch { return false; }
  });
  const windowsBots = botFiles.filter(f => {
    try {
      return JSON.parse(fs.readFileSync(f, 'utf-8')).deviceType === 'windows';
    } catch { return false; }
  });
  // Pick requested number of each
  const selected = [];
  function pickRandom(arr, count) {
    const picks = [];
    const pool = arr.slice();
    while (picks.length < count && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }
    return picks;
  }
  selected.push(...pickRandom(androidBots, Number(androidCount) || 0));
  selected.push(...pickRandom(windowsBots, Number(windowsCount) || 0));
  if (selected.length === 0) {
    return res.json({ success: false, error: 'No bots available for the selected device types.' });
  }
  // Launch each bot
  botLaunchStatus = { pending: selected.length, running: 0, failed: 0, lastError: null };
  // Before launching each bot, kill any previous process for the same botFile
  selected.forEach(botFile => {
    // Find and kill any running bot with the same botFile
    const existing = runningBots.find(b => b.botFile === botFile && b.child && !b.child.killed);
    if (existing) {
      try {
        existing.child.kill('SIGKILL');
        console.log(`[Bot ${botFile.split(/[/\\]/).pop()}] Previous process killed before relaunch.`);
      } catch (e) {
        console.warn(`[Bot ${botFile.split(/[/\\]/).pop()}] Failed to kill previous process:`, e.message);
      }
    }
    const wsPort = nextWsPort++;
    const args = ['tests/bot-runner.js', '--bot', botFile, '--ws-port', wsPort];
    if (targetWebsite) args.push('--target', targetWebsite);
    if (useLocalNetwork) args.push('--no-proxy');
    // Log the launch args and useLocalNetwork value for debugging
    console.log(`[Bot ${botFile.split(/[/\\]/).pop()}] Launching with useLocalNetwork:`, useLocalNetwork, 'args:', args);
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => {
      process.stdout.write(`[Bot ${botFile.split(/[/\\]/).pop()}] ${data}`);
    });
    child.stderr.on('data', data => {
      process.stderr.write(`[Bot ${botFile.split(/[/\\]/).pop()}] ${data}`);
    });
    child.on('exit', (code, signal) => {
      console.log(`[Bot ${botFile.split(/[/\\]/).pop()}] exited with code ${code}, signal ${signal}`);
    });
    runningBots.push({
      child,
      pid: child.pid,
      botFile,
      startTime: new Date().toISOString(),
      wsPort,
      ws: null
    });
  });
  res.json({ success: true, launched: selected.length });
});

// API: Get bot launch status
app.get('/api/launch-status', (req, res) => {
  res.json(botLaunchStatus);
});

// API: List running bots
app.get('/api/runningbots', (req, res) => {
  // Only return info, not child process objects
  const bots = runningBots.filter(b => b.child && !b.child.killed).map(b => ({
    pid: b.pid,
    botFile: b.botFile,
    startTime: b.startTime,
    wsPort: b.wsPort
  }));
  res.json({ running: bots });
});

// API: Send task/command to a running bot (or all)
app.post('/api/sendtask', async (req, res) => {
  const { pids, task } = req.body; // pids: array or 'all', task: object
  if (!task) return res.json({ success: false, error: 'Missing task' });
  let targets = runningBots.filter(b => b.child && !b.child.killed);
  if (Array.isArray(pids)) targets = targets.filter(b => pids.includes(b.pid));
  if (pids === 'all') {/* keep all */}
  if (targets.length === 0) return res.json({ success: false, error: 'No matching bots running' });
  // Send via new WebSocket connection for each bot, with retry/delay
  const results = [];
  for (const bot of targets) {
    let attempts = 0;
    let sent = false;
    let lastError = null;
    while (attempts < 5 && !sent) {
      attempts++;
      const attemptTime = new Date().toISOString();
      try {
        console.log(`[API/sendtask][${attemptTime}] Connecting to ws://localhost:${bot.wsPort} (attempt ${attempts})`);
        const ws = new WebSocket(`ws://localhost:${bot.wsPort}`);
        await new Promise((resolve, reject) => {
          let isOpen = false;
          ws.on('open', () => {
            isOpen = true;
            console.log(`[API/sendtask][${attemptTime}] Connected to bot PID ${bot.pid} on port ${bot.wsPort}`);
            ws.send(JSON.stringify(task), err => {
              if (err) {
                console.log(`[API/sendtask][${attemptTime}] Error sending to bot PID ${bot.pid}:`, err.message);
                lastError = err;
                ws.close();
                reject(err);
              } else {
                console.log(`[API/sendtask][${attemptTime}] Task sent to bot PID ${bot.pid}`);
                results.push({ pid: bot.pid, status: 'sent', attempt: attempts, time: attemptTime });
                ws.close();
                sent = true;
                resolve();
              }
            });
          });
          ws.on('close', (code, reason) => {
            if (!isOpen) {
              console.log(`[API/sendtask][${attemptTime}] WS closed before open for bot PID ${bot.pid} (code: ${code}, reason: ${reason})`);
            } else {
              console.log(`[API/sendtask][${attemptTime}] WS closed for bot PID ${bot.pid} (code: ${code}, reason: ${reason})`);
            }
          });
          ws.on('error', (e) => {
            console.log(`[API/sendtask][${attemptTime}] WS error for bot PID ${bot.pid}:`, e.message);
            lastError = e;
            ws.close();
            reject(e);
          });
        });
      } catch (e) {
        lastError = e;
        console.log(`[API/sendtask][${new Date().toISOString()}] Attempt ${attempts} failed for bot PID ${bot.pid}:`, e.message);
        await new Promise(res => setTimeout(res, 500)); // Wait before retry
      }
    }
    if (!sent) {
      console.log(`[API/sendtask][${new Date().toISOString()}] All attempts failed for bot PID ${bot.pid}. Last error:`, lastError ? lastError.message : 'Unknown error');
      results.push({ pid: bot.pid, status: 'error', error: lastError ? lastError.message : 'Unknown error', attempts });
    }
  }
  res.json({ success: true, results });
});

// API: Close all running bots
app.post('/api/closebots', (req, res) => {
  let closed = 0;
  runningBots.forEach(bot => {
    if (bot.child && !bot.child.killed) {
      bot.child.kill('SIGKILL');
      closed++;
    }
  });
  runningBots.length = 0;
  res.json({ success: true, closed });
});

// API: Close a single running bot by PID
app.post('/api/closebot', (req, res) => {
  const { pid } = req.body;
  console.log('POST /api/closebot body:', req.body);
  if (!pid) {
    return res.json({ success: false, error: 'Missing pid' });
  }
  let closed = false;
  for (const bot of runningBots) {
    if (bot.pid == pid && bot.child && !bot.child.killed) {
      bot.child.kill('SIGKILL');
      closed = true;
      break;
    }
  }
  res.json({ success: closed });
});

// API: Bot info
app.get('/api/botinfo', (req, res) => {
  res.json(getBotInfo());
});

// API: Create a new task (supports both single-step and chain-of-tasks)
app.post('/api/createtask', (req, res) => {
  try {
    saveTask(req.body, path.join(__dirname, 'tasks'));
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// API: Delete a task by name
app.post('/api/deletetask', (req, res) => {
  try {
    const { name } = req.body;
    deleteTask(name, path.join(__dirname, 'tasks'));
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// API: List available tasks
app.get('/api/listtasks', (req, res) => {
  const tasksDir = path.join(__dirname, 'tasks');
  let tasks = [];
  if (fs.existsSync(tasksDir)) {
    tasks = fs.readdirSync(tasksDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''));
  }
  res.json({ tasks });
});

// --- Auto Launch Manager ---
let autoLaunchConfig = null;
let autoLaunchOn = false;
let autoLaunchInterval = null;
let autoLaunchRunningBots = [];

function getAvailableBots(family, excludeBotNames, deviceType) {
  const botsDir = path.join(__dirname, 'Component', 'bots');
  let botFiles = [];
  if (family) {
    const familyDir = path.join(botsDir, family);
    if (fs.existsSync(familyDir)) {
      botFiles = fs.readdirSync(familyDir).map(f => path.join(familyDir, f));
    }
  } else {
    if (fs.existsSync(botsDir)) {
      fs.readdirSync(botsDir).forEach(fam => {
        const familyDir = path.join(botsDir, fam);
        if (fs.statSync(familyDir).isDirectory()) {
          botFiles = botFiles.concat(fs.readdirSync(familyDir).map(f => path.join(familyDir, f)));
        }
      });
    }
  }
  // Filter by deviceType and exclude running
  return botFiles.filter(f => {
    try {
      const bot = JSON.parse(fs.readFileSync(f, 'utf-8'));
      return bot.deviceType === deviceType && !excludeBotNames.includes(bot.name);
    } catch { return false; }
  });
}

function launchAutoBot(botFile, taskFile, onExit) {
  const args = ['tests/bot-runner.js', '--bot', botFile];
  if (taskFile) args.push('--task', taskFile);
  args.push('--randomize'); // Always randomize for auto launch
  if (autoLaunchConfig && autoLaunchConfig.useLocalNetwork) args.push('--no-proxy');
  const child = execFile('node', args, (err, stdout, stderr) => {
    if (err) console.error(`Auto bot error for ${botFile}:`, err.message);
    if (stdout) console.log(`Auto bot output for ${botFile}:`, stdout);
    if (stderr) console.error(`Auto bot stderr for ${botFile}:`, stderr);
  });
  // Track and handle exit
  const botName = path.basename(botFile, '.json');
  const deviceType = JSON.parse(fs.readFileSync(botFile, 'utf-8')).deviceType;
  const botObj = { child, pid: child.pid, botFile, name: botName, deviceType };
  autoLaunchRunningBots.push(botObj);
  child.on('exit', () => {
    // Remove from running list
    const idx = autoLaunchRunningBots.findIndex(b => b.pid === child.pid);
    if (idx !== -1) autoLaunchRunningBots.splice(idx, 1);
    if (autoLaunchOn && typeof onExit === 'function') onExit();
  });
}

function maintainAutoLaunch() {
  if (!autoLaunchOn || !autoLaunchConfig) return;
  // Remove dead bots
  autoLaunchRunningBots = autoLaunchRunningBots.filter(b => b.child && !b.child.killed);
  // Get running names by type
  const runningAndroid = autoLaunchRunningBots.filter(b => b.deviceType === 'android').map(b => b.name);
  const runningWindows = autoLaunchRunningBots.filter(b => b.deviceType === 'windows').map(b => b.name);
  // Randomize target count for this cycle
  const androidTarget = autoLaunchConfig.androidMin + Math.floor(Math.random() * (autoLaunchConfig.androidMax - autoLaunchConfig.androidMin + 1));
  const windowsTarget = autoLaunchConfig.windowsMin + Math.floor(Math.random() * (autoLaunchConfig.windowsMax - autoLaunchConfig.windowsMin + 1));
  // Launch android bots
  while (runningAndroid.length < androidTarget) {
    const available = getAvailableBots(autoLaunchConfig.family, runningAndroid.concat(runningWindows), 'android');
    if (available.length === 0) break;
    const pick = available[Math.floor(Math.random() * available.length)];
    launchAutoBot(pick, autoLaunchConfig.task ? path.join(__dirname, 'tasks', autoLaunchConfig.task + '.json') : null, maintainAutoLaunch);
    runningAndroid.push(JSON.parse(fs.readFileSync(pick, 'utf-8')).name);
  }
  // Launch windows bots
  while (runningWindows.length < windowsTarget) {
    const available = getAvailableBots(autoLaunchConfig.family, runningAndroid.concat(runningWindows), 'windows');
    if (available.length === 0) break;
    const pick = available[Math.floor(Math.random() * available.length)];
    launchAutoBot(pick, autoLaunchConfig.task ? path.join(__dirname, 'tasks', autoLaunchConfig.task + '.json') : null, maintainAutoLaunch);
    runningWindows.push(JSON.parse(fs.readFileSync(pick, 'utf-8')).name);
  }
}

app.post('/api/autolaunch/start', (req, res) => {
  const { family, task, androidMin, androidMax, windowsMin, windowsMax, useLocalNetwork } = req.body;
  if (autoLaunchOn) return res.json({ success: false, error: 'Auto launch already running.' });
  autoLaunchConfig = {
    family: family || '',
    task: task || '',
    androidMin: androidMin || 0,
    androidMax: androidMax || 0,
    windowsMin: windowsMin || 0,
    windowsMax: windowsMax || 0,
    useLocalNetwork: !!useLocalNetwork
  };
  autoLaunchOn = true;
  maintainAutoLaunch();
  autoLaunchInterval = setInterval(maintainAutoLaunch, 5000);
  res.json({ success: true });
});

app.post('/api/autolaunch/stop', (req, res) => {
  autoLaunchOn = false;
  autoLaunchConfig = null;
  if (autoLaunchInterval) clearInterval(autoLaunchInterval);
  // Kill all running auto bots
  autoLaunchRunningBots.forEach(b => { if (b.child && !b.child.killed) b.child.kill('SIGKILL'); });
  autoLaunchRunningBots = [];
  res.json({ success: true });
});

app.get('/api/autolaunch/status', (req, res) => {
  res.json({
    on: autoLaunchOn,
    status: autoLaunchOn ? 'Auto launch is running.' : 'Auto launch is stopped.',
    runningBots: autoLaunchRunningBots.map(b => ({ name: b.name, deviceType: b.deviceType }))
  });
});

// Fallback: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Bot Manager UI running at http://localhost:${PORT}`);
});
