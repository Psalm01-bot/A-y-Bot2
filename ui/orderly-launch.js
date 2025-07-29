// orderly-launch.js: JS for orderly bot launch page

document.addEventListener('DOMContentLoaded', () => {
  const botSelect = document.getElementById('bot-select');
  const taskChainSelect = document.getElementById('task-chain-select');
  const form = document.getElementById('orderly-launch-form');
  const log = document.getElementById('launch-log');

  // TODO: Fetch bot configs and task chains from backend and populate selects
  // Example static population for demo:
  botSelect.innerHTML = '<option value="Component/bots/Legion-hunter/Legion-hunter_029.json">Legion-hunter_029</option>';
  taskChainSelect.innerHTML = '<option value="tasks/Blogger_chain.json">Blogger_chain</option>';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bot = botSelect.value;
    const taskChain = taskChainSelect.value;
    const useLocalNetwork = document.getElementById('use-local-network').checked;
    log.textContent = 'Launching...';

    // Fetch the task chain steps
    let steps = [];
    try {
      const resp = await fetch(`../${taskChain}`);
      steps = await resp.json();
    } catch (err) {
      log.textContent = 'Failed to load task chain: ' + err;
      return;
    }

    // Launch bot via backend API (assumes /api/launch endpoint exists)
    try {
      const launchResp = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot,
          steps,
          useLocalNetwork,
          randomize: false // Orderly execution
        })
      });
      const launchResult = await launchResp.json();
      log.textContent = JSON.stringify(launchResult, null, 2);
    } catch (err) {
      log.textContent = 'Launch failed: ' + err;
    }
  });

  // If loaded as part of the main UI, switch to orderly-launch.html in the same window
  try {
    if (window.top === window.self) {
      // Standalone: do nothing
    } else {
      // In iframe or included: listen for sidebar click in parent
      window.parent.document.getElementById('orderlyLaunchMenuBtn').addEventListener('click', (e) => {
        e.preventDefault();
        window.top.location.href = 'ui/orderly-launch.html';
      });
    }
  } catch (e) {}
});
