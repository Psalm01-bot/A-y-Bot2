// bot-runner.js
// Main bot runner: launches persistent browser for bot, handles WebSocket, tasks, proxy, fingerprint, etc.
const fs = require('fs');
const path = require('path');
//const { plugin } = require('puppeteer-with-fingerprints');
const puppeteer = require('puppeteer');
const minimist = require('minimist');
const WebSocket = require('ws');
const { handleWsTask } = require('./actionHandlers');
const injectMouseHelper = require('./mouseHelper');
const ProxyChain = require('proxy-chain');
const axios = require('axios');

//plugin.setServiceKey(''); // Set your service key if you have one


// Helper: Get timezone from proxy using proxy-chain for all proxy types
/*async function proxyTimeZone(proxy_details) {
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
}*/




async function proxyTimeZoneViaBrowser(proxy_details) {
  let browser = null;
  let anonymizedProxyUrl = null;

  try {
    const protocol = proxy_details.protocol || 'http';
    const proxyUrl = proxy_details.username
      ? `${protocol}://${encodeURIComponent(proxy_details.username)}:${encodeURIComponent(proxy_details.password)}@${proxy_details.server || proxy_details.host}:${proxy_details.port}`
      : `${protocol}://${proxy_details.server || proxy_details.host}:${proxy_details.port}`;

    console.log(`🧪 Launching browser with proxy: ${proxyUrl}`);

    anonymizedProxyUrl = await ProxyChain.anonymizeProxy(proxyUrl);

    browser = await puppeteer.launch({
      headless: true,
      args: [`--proxy-server=${anonymizedProxyUrl}`, '--no-sandbox']
    });

    const page = await browser.newPage();

    if (proxy_details.username && proxy_details.password) {
      await page.authenticate({
        username: proxy_details.username,
        password: proxy_details.password
      });
    }

    // Visit an IP geo service that returns timezone
    await page.goto('https://ipinfo.io/json', { waitUntil: 'domcontentloaded', timeout: 15000 });

    const data = await page.evaluate(() => {
      try {
        return JSON.parse(document.body.innerText);
      } catch (e) {
        return null;
      }
    });

    const timezone = data?.timezone || null;
    console.log(`✅ Detected timezone via IP API: ${timezone}`);

    return timezone;
  } catch (e) {
    console.error('❌ Failed to detect timezone via browser:', e.message);
    return null;
  } finally {
    if (browser) await browser.close();
    if (anonymizedProxyUrl) await ProxyChain.closeAnonymizedProxy(anonymizedProxyUrl, true);
  }
}







const argv = minimist(process.argv.slice(2), {
  boolean: ['no-proxy'],
  alias: { noproxy: 'no-proxy' }
});
let botName = '';
let botConfig = null;
if (argv.bot) {
  const botPath = path.isAbsolute(argv.bot) ? argv.bot : path.resolve(__dirname, argv.bot);
  if (fs.existsSync(botPath)) {
    botConfig = JSON.parse(fs.readFileSync(botPath, 'utf-8'));
    botName = botConfig.name || path.basename(botPath, '.json');
  } else {
    botName = path.basename(argv.bot, '.json');
  }
}
const logPrefix = botName ? `[${botName}]` : '[Bot]';
const wsPort = argv['ws-port'] ? Number(argv['ws-port']) : null;
let wsServer = null;
let wsPage = null;
let page = null;
let browser = null;
let wsTaskBuffer = [];
let wsPageReady = false;

// --- WebSocket server setup ---
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
      await handleWsTask(msg, socket, page, browser, logPrefix);
    });
    socket.send(JSON.stringify({ status: 'connected', bot: botName }));
  });
  wsServer.on('listening', () => {
    console.log(`${logPrefix} WebSocket server listening on port ${wsPort}`);
  });
}

// --- Main browser launch ---
(async () => {
  try {
    // Device and proxy setup
    const deviceType = botConfig ? botConfig.deviceType : 'android';
    let deviceModel = botConfig ? botConfig : { deviceType };
    if (!deviceModel.userAgent) {
      deviceModel.userAgent = deviceType === 'windows'
        ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        : 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    }
    let width = 1280, height = 800, isMobile = false, hasTouch = false;
    if (deviceModel.screenResolution) {
      [width, height] = deviceModel.screenResolution.split(/[ xX]/).map(Number);
    } else if (deviceType === 'android') {
      width = 384; height = 854; isMobile = true; hasTouch = true;
    }
    isMobile = deviceModel.isMobile !== undefined ? deviceModel.isMobile : isMobile;
    hasTouch = deviceModel.hasTouch !== undefined ? deviceModel.hasTouch : hasTouch;
    // Proxy
    let args = ['--no-sandbox', '--disable-setuid-sandbox',
        `--window-size=${width},${height}`,
        '--disable-features=WebRtcHideLocalIpsWithMdns',
        '--disable-webrtc-encryption',
        '--disable-webrtc-multiple-routes',
        `--user-agent=${deviceModel.userAgent}`,
        `--enable-process-per-site-up-to-main-frame-threshold`,
        `--disable-blink-features=AutomationControlled`,
        `--test-type=gpu`, '--aggressive-cache-discard',
        '--disable-cache',
        '--hide-crash-restore-bubble',
        '--disable-application-cache',
        '--disable-offline-load-stale-cache',
        '--disable-gpu-shader-disk-cache',
        '--media-cache-size=0',
        '--disk-cache-size=0',
        '--start-maximized'
    ];
    let selectedProxy = null;
    const useNoProxy = process.argv.includes('--no-proxy');
    console.log(`${logPrefix} [DEBUG] argv['no-proxy']:`, argv['no-proxy'], 'useNoProxy:', useNoProxy);
    if (useNoProxy) {
      // --- NO PROXY MODE ---
      console.log(`${logPrefix} [Proxy] --no-proxy flag set, not using any proxy.`);
      console.log(`${logPrefix} [DEBUG] Puppeteer launch args:`, args);
      browser = await puppeteer.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'],
        ignoreHTTPSErrors: true,
        defaultViewport: null, // Use full browser window size
        args,
        timeout: 60000
      });
    } else {
      // --- PROXY MODE ---
      if (botConfig && botConfig.proxy) {
        selectedProxy = botConfig.proxy;
      } else {
        // Try to load a random proxy from proxy.json
        const proxyPath = path.resolve(__dirname, '../proxy.json');
        if (fs.existsSync(proxyPath)) {
          try {
            const proxies = JSON.parse(fs.readFileSync(proxyPath, 'utf-8'));
            if (Array.isArray(proxies) && proxies.length > 0) {
              selectedProxy = proxies[Math.floor(Math.random() * proxies.length)];
              console.log(`${logPrefix} [Proxy] Selected random proxy:`, selectedProxy);
            } else {
              console.warn(`${logPrefix} [Proxy] proxy.json is empty or invalid.`);
            }
          } catch (e) {
            console.warn(`${logPrefix} [Proxy] Failed to parse proxy.json:`, e.message);
          }
        } else {
          console.warn(`${logPrefix} [Proxy] proxy.json not found.`);
        }
      }
      if (selectedProxy) {
        let protocol = selectedProxy.protocol || 'socks5';
        args.push(`--proxy-server=${protocol}://${selectedProxy.host}:${selectedProxy.port}`);
        console.log(`${logPrefix} [Proxy] Using proxy: ${protocol}://${selectedProxy.host}:${selectedProxy.port}`);
      } else {
        console.log(`${logPrefix} [Proxy] No proxy selected, proceeding without proxy.`);
      }
      console.log(`${logPrefix} [DEBUG] Puppeteer launch args:`, args);
      browser = await puppeteer.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'],
        ignoreHTTPSErrors: true,
        defaultViewport: { width, height, isMobile, hasTouch, deviceScaleFactor: 1.0 },
        args,
        timeout: 30000
      });
    }

    timezone = await proxyTimeZoneViaBrowser(selectedProxy);

        if (timezone) {
        args.push(`--timezone=${timezone}`);
        console.log(`\x1b[32m${logPrefix} ✅ Timezone set to: ${timezone} for proxy ${selectedProxy.host}:${selectedProxy.port}\x1b[0m`);
        } else {
        console.warn(`${logPrefix} ⚠️ Failed to fetch timezone for proxy ${selectedProxy.host}:${selectedProxy.port}`);
        }

    page = await browser.newPage();

            /*if (timezone) {
        try {
            const client = await page.target().createCDPSession();
            await client.send('Emulation.setTimezoneOverride', { timezoneId: timezone });
            console.log(`${logPrefix} ⏰ Timezone override applied in browser: ${timezone}`);
        } catch (err) {
            console.warn(`${logPrefix} ⚠️ Failed to apply timezone override:`, err.message);
        }
        }

        await page.emulateTimezone(timezone);*/


    page.on('targetcreated', async (target) => {
            try {
              const newPage = await target.page();
              if (!newPage || newPage === page) return;

              console.log(`🧨 Popunder opened: ${target.url()}`);

              // Wait a moment for the tab to settle
              await new Promise(res => setTimeout(res, 100));

              // ✅ Bring original test page back to front
              await page.bringToFront();
              console.log(`${logPrefix}✅ Brought test page back to front after popunder`);
            } catch (err) {
              console.error(`${logPrefix}❌ Error handling popunder tab:`, err);
            }
          });

    // Proxy authentication if needed
    if (selectedProxy && selectedProxy.username && selectedProxy.password) {
      try {
        await page.authenticate({
          username: selectedProxy.username,
          password: selectedProxy.password
        });
        console.log(`${logPrefix} [Proxy] Proxy authentication set for user: ${selectedProxy.username}`);
      } catch (e) {
        console.warn(`${logPrefix} [Proxy] Failed to set proxy authentication:`, e.message);
      }
    }
    await page.setUserAgent(deviceModel.userAgent);
    // --- Sync browser window size to viewport ---
    //if (deviceModel.device?.toLowerCase() === 'windows') {
    try {
      const session = await page.target().createCDPSession();
      const { windowId } = await session.send('Browser.getWindowForTarget');
      // Add offset for browser chrome (address bar, tabs, etc.)
      const chromeHeightOffset = 840; // Adjust as needed for your OS/browser
      const chromeWidthOffset = 0; // Usually not needed, but can set e.g. 16
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: { width: width + chromeWidthOffset, height: height + chromeHeightOffset }
      });
      console.log(`${logPrefix} ✅ Browser window size set for Windows device.`);
    } catch (e) {
      console.warn(`${logPrefix} Could not set browser window size:`, e.message);
    }
    // Inject full fingerprint if present
    if (botConfig && botConfig.fingerprint) {
      await page.evaluateOnNewDocument((fp) => {
        // --- Screen spoofing ---
        if (fp.screen) {
          Object.defineProperty(window, 'screen', { value: Object.assign({}, window.screen, fp.screen), configurable: true });
          for (const k in fp.screen) {
            try { window.screen[k] = fp.screen[k]; } catch {}
          }
        }
        // --- Navigator spoofing ---
        if (fp.navigator) {
          const navProto = Object.getPrototypeOf(navigator);
          for (const k in fp.navigator) {
            try {
              Object.defineProperty(navigator, k, { get: () => fp.navigator[k], configurable: true });
            } catch {}
          }
          // userAgentData spoof
          if (fp.navigator.userAgentData) {
            Object.defineProperty(navigator, 'userAgentData', { get: () => fp.navigator.userAgentData, configurable: true });
          }
        }
        // --- Plugins spoofing ---
        if (fp.pluginsData && fp.pluginsData.plugins) {
          Object.defineProperty(navigator, 'plugins', { get: () => fp.pluginsData.plugins, configurable: true });
        }
        // --- MimeTypes spoofing ---
        if (fp.pluginsData && fp.pluginsData.mimeTypes) {
          Object.defineProperty(navigator, 'mimeTypes', { get: () => fp.pluginsData.mimeTypes, configurable: true });
        }
        // --- Audio/Video codecs ---
        if (fp.audioCodecs) {
          window.__audioCodecs = fp.audioCodecs;
        }
        if (fp.videoCodecs) {
          window.__videoCodecs = fp.videoCodecs;
        }
        // --- Fonts spoofing ---
        if (fp.fonts) {
          window.__fonts = fp.fonts;
        }
        // --- Battery spoofing ---
        if (fp.battery) {
          navigator.getBattery = () => Promise.resolve(fp.battery);
        }
        // --- Video card spoofing ---
        if (fp.videoCard) {
          window.__videoCard = fp.videoCard;
        }
        // --- Multimedia devices spoofing ---
        if (fp.multimediaDevices) {
          navigator.mediaDevices.enumerateDevices = () => Promise.resolve([
            ...(fp.multimediaDevices.speakers || []),
            ...(fp.multimediaDevices.micros || []),
            ...(fp.multimediaDevices.webcams || [])
          ]);
        }
        // --- Language spoofing ---
        if (fp.navigator && fp.navigator.language) {
          Object.defineProperty(navigator, 'language', { get: () => fp.navigator.language, configurable: true });
        }
        if (fp.navigator && fp.navigator.languages) {
          Object.defineProperty(navigator, 'languages', { get: () => fp.navigator.languages, configurable: true });
        }
        // --- Platform spoofing ---
        if (fp.navigator && fp.navigator.platform) {
          Object.defineProperty(navigator, 'platform', { get: () => fp.navigator.platform, configurable: true });
        }
        // --- Device memory spoofing ---
        if (fp.navigator && fp.navigator.deviceMemory) {
          Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.navigator.deviceMemory, configurable: true });
        }
        // --- Hardware concurrency spoofing ---
        if (fp.navigator && fp.navigator.hardwareConcurrency) {
          Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.navigator.hardwareConcurrency, configurable: true });
        }
        // --- Touch points spoofing ---
        if (fp.navigator && fp.navigator.maxTouchPoints !== undefined) {
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => fp.navigator.maxTouchPoints, configurable: true });
        }
        // --- Webdriver spoofing ---
        if (fp.navigator && fp.navigator.webdriver !== undefined) {
          Object.defineProperty(navigator, 'webdriver', { get: () => fp.navigator.webdriver, configurable: true });
        }
      }, botConfig.fingerprint);
    }
    // --- Mouse helper and auto-scroll injection ---
    // Mouse helper: show a visible cursor for human-like movement
    await injectMouseHelper(page);
    // Dynamic auto-scroll: scrolls the page up/down randomly to simulate human activity
    /*await page.evaluateOnNewDocument(() => {
      if (window.__autoScrollInjected) return;
      window.__autoScrollInjected = true;
      function randomScroll() {
        if (document.scrollingElement) {
          const maxScroll = document.scrollingElement.scrollHeight - window.innerHeight;
          if (maxScroll > 0) {
            const scrollY = Math.floor(Math.random() * maxScroll);
            window.scrollTo({ top: scrollY, behavior: 'smooth' });
          }
        }
        setTimeout(randomScroll, 2000 + Math.random() * 4000);
      }
      setTimeout(randomScroll, 2000 + Math.random() * 2000);
    });*/
    // Optionally, navigate to a visible start page (not about:blank)
    await page.goto('https://ipscore.io', { waitUntil: 'domcontentloaded', timeout: 60000 });
    wsPageReady = true;
    // If --task is provided, load and execute the task immediately
    if (argv.task) {
      let taskPath = path.isAbsolute(argv.task) ? argv.task : path.resolve(__dirname, argv.task);
      if (fs.existsSync(taskPath)) {
        try {
          const taskData = JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
          let steps = Array.isArray(taskData) ? taskData : taskData.steps;
          if (Array.isArray(steps) && steps.length > 0) {
            const msg = JSON.stringify({ steps });
            const randomize = argv.randomize || false;
            await handleWsTask(msg, null, page, browser, logPrefix, { randomize });
            console.log(`${logPrefix} [Startup] Task from --task executed. Randomize:`, randomize);
            // Exit after task execution (auto launch mode)
            await browser.close();
            process.exit(0);
          } else {
            console.warn(`${logPrefix} [Startup] No steps found in task file:`, argv.task);
          }
        } catch (e) {
          console.error(`${logPrefix} [Startup] Failed to load/execute task:`, e.message);
        }
      } else {
        console.warn(`${logPrefix} [Startup] Task file not found:`, argv.task);
      }
    }
    // Flush any buffered tasks
    for (const msg of wsTaskBuffer) {
      await handleWsTask(msg, wsPage, page, browser, logPrefix);
    }
    wsTaskBuffer = [];
    console.log(`${logPrefix} Bot browser launched and ready.`);
  } catch (err) {
    console.error(`${logPrefix} Failed to launch browser:`, err);
    process.exit(1);
  }
})();

// Removed unused pickRandom and handleWsTask implementations. All WebSocket task handling uses the imported handleWsTask from actionHandlers.js.
