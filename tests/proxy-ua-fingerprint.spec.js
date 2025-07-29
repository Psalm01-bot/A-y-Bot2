// playwright test for scenario: proxy, user-agent, fingerprint, timezone, navigation, waits, and click
const fs = require('fs');
const path = require('path');
const { plugin } = require('puppeteer-with-fingerprints');
const puppeteer = require('puppeteer');
const axios = require('axios');
const minimist = require('minimist');
const WebSocket = require('ws');
const ProxyChain = require('proxy-chain');

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

plugin.setServiceKey(''); // Set your service key if you have one

// Helper: Get timezone from proxy using proxy-chain for all proxy types
async function proxyTimeZone(proxy_details) {
  let anonymizedProxyUrl;
  try {
    const protocol = proxy_details.protocol || 'http';
    let proxyUrl;
    if (proxy_details.username && proxy_details.password) {
      proxyUrl = `${protocol}://${encodeURIComponent(proxy_details.username)}:${encodeURIComponent(proxy_details.password)}@${proxy_details.server || proxy_details.host}:${proxy_details.port}`;
    } else {
      proxyUrl = `${protocol}://${proxy_details.server || proxy_details.host}:${proxy_details.port}`;
    }
    anonymizedProxyUrl = await ProxyChain.anonymizeProxy(proxyUrl);
    // Use the anonymized proxy with axios
    const { HttpsProxyAgent } = require('https-proxy-agent');
    const { HttpProxyAgent } = require('http-proxy-agent');
    const agent = protocol === 'https'
      ? new HttpsProxyAgent(anonymizedProxyUrl)
      : new HttpProxyAgent(anonymizedProxyUrl);
    const response = await axios.get("https://ipapi.co/json", {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 30000
    });
    let timezone = response.data.timezone || response.data.time_zone;
    console.log(`Timezone of the proxy server is ${timezone}`);
    return timezone;
  } catch (e) {
    console.log("couldn't get timezone because of :: ", e.message);
    return null;
  } finally {
    if (anonymizedProxyUrl) {
      await ProxyChain.closeAnonymizedProxy(anonymizedProxyUrl, true);
    }
  }
}

// Helper: Pick a device model based on deviceType
function pickDeviceModel(deviceType) {
  let models;
  if (deviceType === 'android') {
    models = require('../Component/json/android.json').android;
  } else if (deviceType === 'windows') {
    models = require('../Component/json/windows.json').windows;
  } else {
    throw new Error('Unsupported device type: ' + deviceType);
  }
  return getRandomItem(models);
}

// Helper: Try proxies in order until one works for both timezone and browser, with logging and retry
async function getWorkingProxyAndTimezone(proxies, isMobile) {
  for (const proxy of proxies) {
    const protocol = proxy.protocol || 'socks5';
    console.log(`\n[Proxy Test] Trying proxy: ${proxy.host}:${proxy.port} (${protocol})`);
    // 1. Try to get timezone
    let timezone = null;
    try {
      timezone = await proxyTimeZone({
        server: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
        protocol: protocol
      });
      if (!timezone) throw new Error('Timezone fetch failed');
      console.log(`\x1b[32m✅ Timezone set to: ${timezone} for proxy ${proxy.host}:${proxy.port}\x1b[0m`);
    } catch (e) {
      console.log(`[Proxy Test] Timezone fetch failed: ${e.message}`);
      continue;
    }
    // 2. Try browser connection with retry
    let browserOk = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let anonymizedProxyUrl = null;
      try {
        console.log(`[Proxy Test] Browser connection attempt ${attempt}...`);
        // Use proxy-chain to create an anonymized proxy URL
        let proxyUrl;
        if (proxy.username && proxy.password) {
          proxyUrl = `${protocol}://${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@${proxy.host}:${proxy.port}`;
        } else {
          proxyUrl = `${protocol}://${proxy.host}:${proxy.port}`;
        }
        anonymizedProxyUrl = await ProxyChain.anonymizeProxy(proxyUrl);
        const testBrowser = await puppeteer.launch({
          headless: false, // was true, now false for debugging
          ignoreDefaultArgs: ['--enable-automation'],
          ignoreHTTPSErrors: true,
          defaultViewport: { width: 100, height: 100, isMobile, hasTouch: isMobile, deviceScaleFactor: 1.0 },
          args: [
            `--proxy-server=${anonymizedProxyUrl}`,
            '--no-sandbox', '--disable-setuid-sandbox',
          ],
          timeout: 20000
        });
        const testPage = await testBrowser.newPage();
        // No need to authenticate, proxy-chain handles it
        await new Promise(res => setTimeout(res, 2000));

        testPage.on('targetcreated', async (target) => {
            try {
              const newPage = await target.page();
              if (!newPage || newPage === testPage) return;

              console.log(`🧨 Popunder opened: ${target.url()}`);

              // Wait a moment for the tab to settle
              await new Promise(res => setTimeout(res, 100));

              // ✅ Bring original test page back to front
              await testPage.bringToFront();
              console.log(`${logPrefix}✅ Brought test page back to front after popunder`);
            } catch (err) {
              console.error(`${logPrefix}❌ Error handling popunder tab:`, err);
            }
          });


        // Intercept navigation attempts
        await testPage.setRequestInterception(true);
        
        await testPage.goto('https://ipscore.io', { timeout: 20000 });
        await testBrowser.close();
        browserOk = true;
        console.log(`[Proxy Test] Browser connection succeeded.`);
        break;
      } catch (e) {
        console.log(`[Proxy Test] Browser connection failed (attempt ${attempt}): ${e.message}`);
        await new Promise(res => setTimeout(res, 3000)); // Wait before retry
      } finally {
        if (anonymizedProxyUrl) {
          await ProxyChain.closeAnonymizedProxy(anonymizedProxyUrl, true);
        }
      }
    }
    if (browserOk) {
      return { proxy, timezone };
    } else {
      console.log(`[Proxy Test] Proxy failed for browser connection after retries.`);
    }
  }
  throw new Error('No working proxy found for both timezone and browser connection.');
}

// Parse --bot argument early for logPrefix
const argv = minimist(process.argv.slice(2));
let botName = '';
if (argv.bot) {
  const botPath = path.isAbsolute(argv.bot) ? argv.bot : path.resolve(__dirname, argv.bot);
  if (fs.existsSync(botPath)) {
    try {
      const botConfig = JSON.parse(fs.readFileSync(botPath, 'utf-8'));
      botName = botConfig.name || path.basename(botPath, '.json');
    } catch {
      botName = path.basename(botPath, '.json');
    }
  } else {
    botName = path.basename(argv.bot, '.json');
  }
}
const logPrefix = botName ? `[${botName}]` : '[Bot]';

const wsPort = argv['ws-port'] ? Number(argv['ws-port']) : null;
let wsServer = null;
let wsPage = null;
let page = null; // Make page accessible to WebSocket handler
let wsTaskBuffer = [];
let wsPageReady = false;

if (wsPort) {
  wsServer = new WebSocket.Server({ port: wsPort });
  wsServer.on('connection', (socket) => {
    wsPage = socket;
    socket.on('message', async (msg) => {
      if (!wsPageReady) {
        wsTaskBuffer.push(msg);
        console.log(`${logPrefix} [WS] Task buffered (page not ready)`);
        return;
      }
      await handleWsTask(msg, socket);
    });
    socket.send(JSON.stringify({ status: 'connected', bot: botName }));
  });
  wsServer.on('listening', () => {
    console.log(`${logPrefix} WebSocket server listening on port ${wsPort}`);
  });
}



async function handleWsTask(msg, socket) {
  let data;
  try { data = JSON.parse(msg); } catch { data = { type: 'raw', msg: msg.toString() }; }
  if (data && data.type === 'task' && page) {
    // CHAIN OF TASKS SUPPORT
    if (Array.isArray(data.steps) && data.steps.length > 0) {
      let results = [];
      for (const step of data.steps) {
        try {
          if (step.url) {
            console.log(`${logPrefix} [WS] [CHAIN] Navigating to: ${step.url}`);
            await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            results.push({ type: 'navigate', url: step.url, status: 'ok' });
            // Wait a random time after navigation if specified
            const minNav = typeof step.minWaitAfterNav === 'number' ? step.minWaitAfterNav : 1;
            const maxNav = typeof step.maxWaitAfterNav === 'number' ? step.maxWaitAfterNav : 3;
            const navWait = minNav + Math.random() * (maxNav - minNav);
            console.log(`${logPrefix} [WS] [CHAIN] Waiting ${navWait.toFixed(2)}s after navigation...`);
            await new Promise(res => setTimeout(res, navWait * 1000));
            humanMouseAndScroll(page, logPrefix);
          }
          if (Array.isArray(step.actions)) {
            for (const action of step.actions) {
              try {
                console.log(`${logPrefix} [WS] [CHAIN] Executing action:`, action);
                if (action.type === 'pop-under-click') {
                  const x = action.x !== undefined ? action.x : 100 + Math.floor(Math.random() * 200);
                  const y = action.y !== undefined ? action.y : 100 + Math.floor(Math.random() * 200);
                  await page.mouse.click(x, y);
                  console.log(`${logPrefix} [WS] [CHAIN] Performed pop-under click at (${x}, ${y})`);
                  // Wait only here for pop-under-click
                  const wait = (action.minWait || 1) + Math.random() * ((action.maxWait || 2) - (action.minWait || 1));
                  await new Promise(res => setTimeout(res, wait * 1000));
                } else if (action.type === 'click-xpath' && action.value) {
                  await page.waitForXPath(action.value, { timeout: 10000 });
                  const [el] = await page.$x(action.value);
                  if (el) await el.click();
                  results.push({ type: 'click-xpath', xpath: action.value });
                  // Wait after click-xpath
                  const wait = (action.minWait || 1) + Math.random() * ((action.maxWait || 2) - (action.minWait || 1));
                  await new Promise(res => setTimeout(res, wait * 1000));
                } else if (action.type === 'click-similar-links' && action.value) {
                  const links = await page.$$('a');
                  for (const link of links) {
                    const text = await page.evaluate(el => el.textContent, link);
                    // You may want to add logic here to match the link text with action.value
                  }
                }
              } catch (err) {
                console.error(`${logPrefix} [WS] [CHAIN] Step error:`, err);
              }
            }
          }
        } catch (err) {
          console.error(`${logPrefix} [WS] [CHAIN] Step error:`, err);
        }
      }
    }
  }
}
