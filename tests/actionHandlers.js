// actionHandlers.js
// Exports a function to handle a single action in the bot runner context

module.exports = async function handleAction(action, page, browser, logPrefix) {
  let result = null;
  try {
    if (action.type === 'pop-under-click') {
      const x = action.x !== undefined ? action.x : 100 + Math.floor(Math.random() * 200);
      const y = action.y !== undefined ? action.y : 100 + Math.floor(Math.random() * 200);
      await page.mouse.click(x, y);
      console.log(`${logPrefix} [WS] [CHAIN] Performed pop-under click at (${x}, ${y})`);
      const wait = (action.minWait || 1) + Math.random() * ((action.maxWait || 2) - (action.minWait || 1));
      await new Promise(res => setTimeout(res, wait * 1000));
      result = { type: 'pop-under-click', x, y };
    } else if (action.type === 'click-xpath' && action.value) {
      await page.waitForXPath(action.value, { timeout: 10000 });
      const [el] = await page.$x(action.value);
      if (el) await el.click();
      const wait = (action.minWait || 1) + Math.random() * ((action.maxWait || 2) - (action.minWait || 1));
      await new Promise(res => setTimeout(res, wait * 1000));
      result = { type: 'click-xpath', xpath: action.value };
    } else if (action.type === 'click-similar-links' && action.value) {
        const links = await page.$$('a');
        let found = false;
        const baseUrl = action.value;

        // First attempt: Match based on text
        for (const link of links) {
          const text = await page.evaluate(el => el.textContent, link);
          if (text && text.includes(action.value)) {
            await link.click();
            const wait = (action.minWait || 1) + Math.random() * ((action.maxWait || 2) - (action.minWait || 1));
            await new Promise(res => setTimeout(res, wait * 1000));
            found = true;
            result = { type: 'click-similar-links', text: action.value };
            break;
          }
        }

        // Fallback: Match based on base URL using page.evaluate
        if (!found && baseUrl) {
          const clickResult = await page.evaluate((baseUrl) => {
            const regex = new RegExp(`^${baseUrl}`);
            const links = Array.from(document.querySelectorAll('a')).filter(a => regex.test(a.href));
            if (links.length > 0) {
              const randomLink = links[Math.floor(Math.random() * links.length)];
              randomLink.click();
              return "success";
            }
            return "failed";
          }, action.value);

          if (clickResult === "success") {
            try {
              await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 });
            } catch (e) {
              // Ignore timeout or no navigation
            }

            found = true;
            result = { type: 'click-similar-links', baseUrl: action.value, method: 'base-url-match' };
          } else {
            result = { type: 'click-similar-links', baseUrl: action.value, status: 'not-found' };
          }
        }

        // Final fallback if nothing worked
        if (!found && !result) {
          result = { type: 'click-similar-links', text: action.value, status: 'not-found' };
        }
} else if (action.type === 'input' && action.selector) {
      const { selector, value } = action;
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.click(selector);
      await page.keyboard.type(value.toString(), { delay: 100 });
      const wait = (action.minWait || 1) + Math.random() * ((action.maxWait || 2) - (action.minWait || 1));
      await new Promise(res => setTimeout(res, wait * 1000));
      result = { type: 'input', selector, value };
    } else if (action.type === 'wait' && typeof action.time === 'number') {
      const waitTime = action.time + Math.random() * 1000;
      console.log(`${logPrefix} [WS] [CHAIN] Waiting ${waitTime.toFixed(2)}ms`);
      await new Promise(res => setTimeout(res, waitTime));
      result = { type: 'wait', time: waitTime };
    } else if (action.type === 'evaluate' && typeof action.pageFunction === 'string') {
      const func = new Function('page', 'browser', action.pageFunction);
      const evalResult = await func(page, browser);
      result = { type: 'evaluate', result: evalResult };
    } else {
      console.warn(`${logPrefix} [WS] [CHAIN] Ignored unknown action type: ${action.type}`);
      result = { type: 'unknown-action', action: action.type };
    }
  } catch (e) {
    console.error(`${logPrefix} [WS] [CHAIN] Error executing action ${action.type}:`, e);
    result = { type: 'action-error', action: action.type, message: e.message };
  }
  return result;
};

// Utility: pick a random element from an array
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- WebSocket task handler ---
// Accepts an extra option: { randomize: true } to pick a random step from the chain
module.exports.handleWsTask = async function handleWsTask(msg, socket, page, browser, logPrefix, options = {}) {
  let data;
  if (Buffer.isBuffer(msg)) msg = msg.toString();
  try { data = JSON.parse(msg); } catch { data = { type: 'raw', msg: msg.toString() }; }
  console.log(`${logPrefix} [WS] handleWsTask received:`, data);
  if (data && Array.isArray(data.steps) && page) {
    let steps = data.steps;
    if (Array.isArray(steps) && steps.length > 0) {
      let results = [];
      if (options.randomize) {
        // Pick a random step from the chain and execute only that
        const step = pickRandom(steps);
        try {
          if (step.url) {
            console.log(`${logPrefix} [WS] [CHAIN] Navigating to: ${step.url}`);
            await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.evaluateOnNewDocument(() => {
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
                    });
            results.push({ type: 'navigate', url: step.url, status: 'ok' });
            const minNav = typeof step.minWaitAfterNav === 'number' ? step.minWaitAfterNav : 1;
            const maxNav = typeof step.maxWaitAfterNav === 'number' ? step.maxWaitAfterNav : 3;
            const navWait = minNav + Math.random() * (maxNav - minNav);
            console.log(`${logPrefix} [WS] [CHAIN] Waiting ${navWait.toFixed(2)}s after navigation...`);
            await new Promise(res => setTimeout(res, navWait * 1000));
          }
          if (Array.isArray(step.actions)) {
            for (const action of step.actions) {
              const actionResult = await module.exports(action, page, browser, logPrefix);
              if (actionResult) results.push(actionResult);
            }
          }
        } catch (e) {
          console.error(`${logPrefix} [WS] [CHAIN] Error in random step execution:`, e);
          results.push({ type: 'step-error', message: e.message });
        }
      } else {
        // Execute all steps in order
        for (const step of steps) {
          try {
            if (step.url) {
              console.log(`${logPrefix} [WS] [CHAIN] Navigating to: ${step.url}`);
              await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
              await page.evaluateOnNewDocument(() => {
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
                        });
              results.push({ type: 'navigate', url: step.url, status: 'ok' });
              const minNav = typeof step.minWaitAfterNav === 'number' ? step.minWaitAfterNav : 1;
              const maxNav = typeof step.maxWaitAfterNav === 'number' ? step.maxWaitAfterNav : 3;
              const navWait = minNav + Math.random() * (maxNav - minNav);
              console.log(`${logPrefix} [WS] [CHAIN] Waiting ${navWait.toFixed(2)}s after navigation...`);
              await new Promise(res => setTimeout(res, navWait * 1000));
            }
            if (Array.isArray(step.actions)) {
              for (const action of step.actions) {
                const actionResult = await module.exports(action, page, browser, logPrefix);
                if (actionResult) results.push(actionResult);
              }
            }
          } catch (e) {
            console.error(`${logPrefix} [WS] [CHAIN] Error executing step:`, e);
            results.push({ type: 'step-error', message: e.message });
          }
        }
      }
      // Send back the results of the executed steps
      try {
        socket.send(JSON.stringify({ type: 'task-results', results }));
        console.log(`${logPrefix} [WS] Sent task results:`, results);
      } catch (e) {
        console.error(`${logPrefix} [WS] Error sending task results:`, e);
      }
    } else {
      console.warn(`${logPrefix} [WS] [CHAIN] No valid steps found in message`);
    }
  } else {
    console.warn(`${logPrefix} [WS] [CHAIN] Ignored message with no steps`);
  }
};
