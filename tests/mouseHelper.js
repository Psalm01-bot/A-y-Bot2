// mouseHelper.js
// Exports a function to inject a mouse helper into a Puppeteer page

module.exports = async function injectMouseHelper(page) {
  await page.evaluateOnNewDocument(() => {
    if (window.__mouseHelperInjected) return;
    window.__mouseHelperInjected = true;
    const box = document.createElement('div');
    box.id = 'mouse-helper';
    box.style.position = 'fixed';
    box.style.pointerEvents = 'none';
    box.style.zIndex = '999999';
    box.style.width = '32px';
    box.style.height = '32px';
    box.style.background = 'url("/image/okecbot-bounce.png") no-repeat center center / contain';
    box.style.left = '0px';
    box.style.top = '0px';
    document.body.appendChild(box);
    // Simulate random mouse movement
    function moveMouseHelper() {
      const w = window.innerWidth - 32;
      const h = window.innerHeight - 32;
      const x = Math.floor(Math.random() * w);
      const y = Math.floor(Math.random() * h);
      box.style.left = x + 'px';
      box.style.top = y + 'px';
      setTimeout(moveMouseHelper, 1200 + Math.random() * 1800);
    }
    moveMouseHelper();
    document.addEventListener('mousemove', e => {
      box.style.left = e.pageX + 'px';
      box.style.top = e.pageY + 'px';
    }, true);
  });
};
