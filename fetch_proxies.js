// fetch_proxies.js
// Scrape https://socks-proxy.net/ using Puppeteer and save proxies to proxy.json
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const url = 'https://socks-proxy.net/';
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'accept-language': 'en-US,en;q=0.9'
  });
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Wait for the table to load
  await page.waitForSelector('#proxylisttable', { timeout: 60000 });
  await page.waitForTimeout(5000);

  // Debug: log table HTML
  const tableHTML = await page.evaluate(() => {
    return document.querySelector('#proxylisttable')?.outerHTML || 'Table not found';
  });
  fs.writeFileSync('proxy_table_debug.html', tableHTML);

  const proxies = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#proxylisttable tbody tr'));
    return rows.map(row => {
      const cols = row.querySelectorAll('td');
      const ip = cols[0]?.innerText.trim();
      const port = cols[1]?.innerText.trim();
      const version = cols[4]?.innerText.trim().toLowerCase(); // SOCKS4 or SOCKS5
      if (ip && port && version) {
        return {
          host: ip,
          port: parseInt(port, 10),
          protocol: version.includes('5') ? 'socks5' : 'socks4'
        };
      }
      return null;
    }).filter(Boolean);
  });

  await browser.close();
  fs.writeFileSync('proxy.json', JSON.stringify(proxies, null, 2));
  console.log(`Saved ${proxies.length} proxies to proxy.json`);
})();
