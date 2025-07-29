// ui.js
// Handles UI logic and calls backend endpoints (to be implemented with Node.js/Express or similar)

document.addEventListener('DOMContentLoaded', () => {
  const createBotMenuBtn = document.getElementById('createBotMenuBtn');
  const launchBotMenuBtn = document.getElementById('launchBotMenuBtn');
  const runningBotsMenuBtn = document.getElementById('runningBotsMenuBtn');
  const createBotMenu = document.getElementById('createBotMenu');
  const launchBotMenu = document.getElementById('launchBotMenu');
  const runningBotsMenu = document.getElementById('runningBotsMenu');
  const createBotForm = document.getElementById('createBotForm');
  const launchBotForm = document.getElementById('launchBotForm');
  const createBotSuccess = document.getElementById('createBotSuccess');
  const launchBotSuccess = document.getElementById('launchBotSuccess');
  const runningBotsList = document.getElementById('runningBotsList');
  const createTaskMenuBtn = document.getElementById('createTaskMenuBtn');
  const createTaskMenu = document.getElementById('createTaskMenu');
  const createTaskForm = document.getElementById('createTaskForm');
  const createTaskSuccess = document.getElementById('createTaskSuccess');
  const actionsList = document.getElementById('actionsList');
  const addActionBtn = document.getElementById('addActionBtn');
  const autoLaunchMenuBtn = document.getElementById('autoLaunchMenuBtn');
  const autoLaunchMenu = document.getElementById('autoLaunchMenu');
  const autoLaunchForm = document.getElementById('autoLaunchForm');
  const autoLaunchFamilyNameSelect = document.getElementById('autoLaunchFamilyNameSelect');
  const autoLaunchTaskSelect = document.getElementById('autoLaunchTaskSelect');
  const autoAndroidCount = document.getElementById('autoAndroidCount');
  const autoWindowsCount = document.getElementById('autoWindowsCount');
  const autoAndroidMin = document.getElementById('autoAndroidMin');
  const autoAndroidMax = document.getElementById('autoAndroidMax');
  const autoWindowsMin = document.getElementById('autoWindowsMin');
  const autoWindowsMax = document.getElementById('autoWindowsMax');
  const autoLaunchSwitch = document.getElementById('autoLaunchSwitch');
  const autoLaunchStatus = document.getElementById('autoLaunchStatus');
  const autoLaunchBots = document.getElementById('autoLaunchBots');
  const orderlyLaunchMenuBtn = document.getElementById('orderlyLaunchMenuBtn');
  const orderlyLaunchMenu = document.getElementById('orderlyLaunchMenu');
  const orderlyLaunchForm = document.getElementById('orderlyLaunchForm');
  const orderlyBotFamilySelect = document.getElementById('orderlyBotFamilySelect');
  const orderlyBotSelect = document.getElementById('orderlyBotSelect');
  const orderlyTaskChainSelect = document.getElementById('orderlyTaskChainSelect');
  const orderlyUseLocalNetwork = document.getElementById('orderlyUseLocalNetwork');
  const orderlyLaunchLog = document.getElementById('orderlyLaunchLog');

  // Menu switching
  createBotMenuBtn.addEventListener('click', () => {
    setPageUrl('createBot');
    createBotMenuBtn.classList.add('active');
    launchBotMenuBtn.classList.remove('active');
    runningBotsMenuBtn.classList.remove('active');
    createBotMenu.style.display = '';
    launchBotMenu.style.display = 'none';
    runningBotsMenu.style.display = 'none';
  });
  launchBotMenuBtn.addEventListener('click', () => {
    setPageUrl('launchBot');
    launchBotMenuBtn.classList.add('active');
    createBotMenuBtn.classList.remove('active');
    runningBotsMenuBtn.classList.remove('active');
    launchBotMenu.style.display = '';
    createBotMenu.style.display = 'none';
    runningBotsMenu.style.display = 'none';
  });
  runningBotsMenuBtn.addEventListener('click', () => {
    setPageUrl('runningBots');
    runningBotsMenuBtn.classList.add('active');
    createBotMenuBtn.classList.remove('active');
    launchBotMenuBtn.classList.remove('active');
    createBotMenu.style.display = 'none';
    launchBotMenu.style.display = 'none';
    runningBotsMenu.style.display = '';
    fetchRunningBots();
  });
  createTaskMenuBtn.addEventListener('click', () => {
    setPageUrl('createTask');
    createTaskMenuBtn.classList.add('active');
    createBotMenuBtn.classList.remove('active');
    launchBotMenuBtn.classList.remove('active');
    runningBotsMenuBtn.classList.remove('active');
    createTaskMenu.style.display = '';
    createBotMenu.style.display = 'none';
    launchBotMenu.style.display = 'none';
    runningBotsMenu.style.display = 'none';
  });
  autoLaunchMenuBtn.addEventListener('click', () => {
    setPageUrl('autoLaunch');
    autoLaunchMenuBtn.classList.add('active');
    createBotMenuBtn.classList.remove('active');
    launchBotMenuBtn.classList.remove('active');
    runningBotsMenuBtn.classList.remove('active');
    createTaskMenuBtn.classList.remove('active');
    autoLaunchMenu.style.display = '';
    createBotMenu.style.display = 'none';
    launchBotMenu.style.display = 'none';
    runningBotsMenu.style.display = 'none';
    createTaskMenu.style.display = 'none';
    updateAutoLaunchFamilyOptions();
    updateAutoLaunchTaskOptions();
    fetchAutoLaunchStatus();
  });
  orderlyLaunchMenuBtn.addEventListener('click', () => {
    setPageUrl('orderlyLaunch');
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    orderlyLaunchMenuBtn.classList.add('active');
    document.querySelectorAll('.menu-content').forEach(menu => menu.style.display = 'none');
    orderlyLaunchMenu.style.display = '';
    updateOrderlyFamilies();
    updateOrderlyTaskChains();
  });

  // Modal logic
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const modalClose = document.getElementById('modalClose');
  function showModal(message) {
    modalMessage.textContent = message;
    modal.style.display = 'flex';
  }
  modalClose.onclick = () => { modal.style.display = 'none'; };
  window.onclick = (event) => { if (event.target === modal) modal.style.display = 'none'; };

  // Create Bot Form
  createBotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    createBotSuccess.style.display = 'none';
    const familyName = document.getElementById('familyName').value.trim();
    const androidCount = parseInt(document.getElementById('androidCount').value, 10);
    const windowsCount = parseInt(document.getElementById('windowsCount').value, 10);
    try {
      const res = await fetch('/api/createbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyName, androidCount, windowsCount })
      });
      const data = await res.json();
      if (data.success) {
        showModal(`Successfully created ${data.count} bots for family '${familyName}'.`);
        createBotForm.reset();
        await updateBotInfo();
      } else {
        showModal(data.error || 'Failed to create bots.');
      }
    } catch (err) {
      showModal('Error: ' + err.message);
    }
  });

  // --- Bot info for launch page ---
  async function updateBotInfo() {
    const res = await fetch('/api/botinfo');
    const info = await res.json();
    // Populate family name select
    const familySelect = document.getElementById('launchFamilyNameSelect');
    familySelect.innerHTML = '';
    const optAny = document.createElement('option');
    optAny.value = '';
    optAny.textContent = 'Any Family (Random)';
    familySelect.appendChild(optAny);
    info.families.forEach(fam => {
      const opt = document.createElement('option');
      opt.value = fam;
      opt.textContent = fam;
      familySelect.appendChild(opt);
    });
    // Show bot counts
    document.getElementById('botStats').textContent =
      `Total Bots: ${info.total} | Android: ${info.android} | Windows: ${info.windows}`;
  }
  updateBotInfo();

  // Launch Bot Form
  launchBotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    launchBotSuccess.style.display = 'none';
    launchBotSuccess.textContent = '';
    // Show launching status
    launchBotSuccess.style.display = 'block';
    launchBotSuccess.textContent = 'Launching bot(s)...';
    const launchFamilyName = document.getElementById('launchFamilyNameSelect').value;
    const androidCount = parseInt(document.getElementById('launchAndroidCount').value, 10) || 0;
    const windowsCount = parseInt(document.getElementById('launchWindowsCount').value, 10) || 0;
    const targetWebsite = document.getElementById('targetWebsite').value.trim();
    const useLocalNetwork = document.getElementById('useLocalNetworkToggle').checked;
    let pollInterval;
    try {
      const res = await fetch('/api/launchbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchFamilyName, androidCount, windowsCount, targetWebsite, useLocalNetwork })
      });
      let data;
      try {
        data = await res.json();
      } catch (err) {
        const text = await res.text();
        showModal('Server error: ' + text);
        launchBotSuccess.style.display = 'none';
        return;
      }
      if (data.success) {
        // Poll for launch status
        let lastStatus = '';
        pollInterval = setInterval(async () => {
          const statusRes = await fetch('/api/launch-status');
          const status = await statusRes.json();
          let msg = `Launching... (${status.running} running, ${status.failed} failed, ${status.pending} pending)`;
          if (status.failed > 0 && status.lastError) {
            msg += `\nLast error: ${status.lastError}`;
          }
          launchBotSuccess.textContent = msg;
          if (status.pending === 0) {
            clearInterval(pollInterval);
            if (status.failed === 0) {
              launchBotSuccess.textContent = `Launched ${status.running} bot instance(s) successfully.`;
            } else {
              launchBotSuccess.textContent = `Launched ${status.running} bot(s), ${status.failed} failed. Last error: ${status.lastError || ''}`;
            }
            launchBotForm.reset();
            await updateBotInfo();
          }
        }, 1500);
      } else {
        launchBotSuccess.textContent = data.error || 'Failed to launch bots.';
        launchBotSuccess.style.display = 'block';
      }
    } catch (err) {
      launchBotSuccess.textContent = 'Error: ' + err.message;
      launchBotSuccess.style.display = 'block';
    }
  });

  // Close All Bots button
  const closeBotsBtn = document.getElementById('closeBotsBtn');
  if (closeBotsBtn) {
    closeBotsBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/closebots', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showModal(`Closed ${data.closed} running bot instance(s).`);
        } else {
          showModal('Failed to close bots.');
        }
      } catch (e) {
        showModal('Error closing bots: ' + e.message);
      }
    });
  }

  async function fetchRunningBots() {
    runningBotsList.textContent = 'Loading...';
    try {
      const res = await fetch('/api/runningbots');
      const data = await res.json();
      if (data.running && data.running.length > 0) {
        runningBotsList.innerHTML = data.running.map(b => {
          const botName = b.botFile.split(/[/\\]/).pop();
          return `<div class="bot-instance">
            <div class="bot-main"><b>${botName}</b></div>
            <div class="bot-details">
              <span><b>PID:</b> ${b.pid}</span>
              <span><b>Started:</b> ${new Date(b.startTime).toLocaleString()}</span>
              <button class="close-bot-btn" data-pid="${b.pid}">Close</button>
            </div>
          </div>`;
        }).join('');
        // Add event listeners for close buttons
        document.querySelectorAll('.close-bot-btn').forEach(btn => {
          btn.onclick = async function() {
            const pid = this.getAttribute('data-pid');
            try {
              const res = await fetch('/api/closebot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pid })
              });
              const result = await res.json();
              if (result.success) {
                showModal('Bot instance closed.');
                fetchRunningBots();
              } else {
                showModal('Failed to close bot instance.');
              }
            } catch (e) {
              showModal('Error closing bot: ' + e.message);
            }
          };
        });
      } else {
        runningBotsList.textContent = 'No bots are currently running.';
      }
    } catch (e) {
      runningBotsList.textContent = 'Error loading running bots.';
    }
  }

  // Auto Launch menu logic
  async function updateAutoLaunchFamilyOptions() {
    const res = await fetch('/api/botinfo');
    const info = await res.json();
    autoLaunchFamilyNameSelect.innerHTML = '';
    const optAny = document.createElement('option');
    optAny.value = '';
    optAny.textContent = 'Any Family (Random)';
    autoLaunchFamilyNameSelect.appendChild(optAny);
    info.families.forEach(fam => {
      const opt = document.createElement('option');
      opt.value = fam;
      opt.textContent = fam;
      autoLaunchFamilyNameSelect.appendChild(opt);
    });
  }
  async function updateAutoLaunchTaskOptions() {
    const res = await fetch('/api/listtasks');
    const info = await res.json();
    autoLaunchTaskSelect.innerHTML = '';
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = 'None';
    autoLaunchTaskSelect.appendChild(optNone);
    info.tasks.forEach(task => {
      const opt = document.createElement('option');
      opt.value = task;
      opt.textContent = task;
      autoLaunchTaskSelect.appendChild(opt);
    });
  }

  // Auto Launch Switch logic
  let autoLaunchOn = false;
  autoLaunchSwitch.onclick = async () => {
    if (!autoLaunchOn) {
      // Start auto launch
      const family = autoLaunchFamilyNameSelect.value;
      const task = autoLaunchTaskSelect.value;
      const androidMin = parseInt(autoAndroidMin.value, 10) || 0;
      const androidMax = parseInt(autoAndroidMax.value, 10) || 0;
      const windowsMin = parseInt(autoWindowsMin.value, 10) || 0;
      const windowsMax = parseInt(autoWindowsMax.value, 10) || 0;
      const useLocalNetwork = document.getElementById('autoUseLocalNetworkToggle').checked;
      const res = await fetch('/api/autolaunch/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family, task, androidMin, androidMax, windowsMin, windowsMax, useLocalNetwork })
      });
      const data = await res.json();
      if (data.success) {
        autoLaunchOn = true;
        autoLaunchSwitch.classList.remove('off');
        autoLaunchSwitch.classList.add('on');
        autoLaunchSwitch.textContent = 'Auto Launch ON';
        fetchAutoLaunchStatus();
      } else {
        showModal('Failed to start auto launch: ' + (data.error || 'Unknown error'));
      }
    } else {
      // Stop auto launch
      const res = await fetch('/api/autolaunch/stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        autoLaunchOn = false;
        autoLaunchSwitch.classList.remove('on');
        autoLaunchSwitch.classList.add('off');
        autoLaunchSwitch.textContent = 'Auto Launch OFF';
        fetchAutoLaunchStatus();
      } else {
        showModal('Failed to stop auto launch: ' + (data.error || 'Unknown error'));
      }
    }
  };

  async function fetchAutoLaunchStatus() {
    const res = await fetch('/api/autolaunch/status');
    const data = await res.json();
    autoLaunchStatus.textContent = data.status || '';
    autoLaunchBots.innerHTML = data.runningBots && data.runningBots.length > 0
      ? data.runningBots.map(b => `<div>${b.name} (${b.deviceType})</div>`).join('')
      : '<div>No bots running.</div>';
    autoLaunchOn = !!data.on;
    if (autoLaunchOn) {
      autoLaunchSwitch.classList.remove('off');
      autoLaunchSwitch.classList.add('on');
      autoLaunchSwitch.textContent = 'Auto Launch ON';
    } else {
      autoLaunchSwitch.classList.remove('on');
      autoLaunchSwitch.classList.add('off');
      autoLaunchSwitch.textContent = 'Auto Launch OFF';
    }
  }

  // --- Active Bots Control UI logic ---
  const activeBotsToggle = document.getElementById('activeBotsToggle');
  const activeBotsControl = document.getElementById('activeBotsControl');
  const activeBotsSelect = document.getElementById('activeBotsSelect');
  const sendTaskForm = document.getElementById('sendTaskForm');
  const sendToAllBtn = document.getElementById('sendToAllBtn');
  const sendToSelectedBtn = document.getElementById('sendToSelectedBtn');
  const sendTaskResult = document.getElementById('sendTaskResult');
  let runningBotsCache = [];
  let availableTasks = [];

  // Fetch available tasks for dropdown
  async function fetchAvailableTasks() {
    const res = await fetch('/api/listtasks');
    const data = await res.json();
    availableTasks = data.tasks || [];
  }

  // Populate bot checkboxes and task dropdown
  async function populateActiveBotsControl() {
    await fetchAvailableTasks();
    // Fetch running bots
    const res = await fetch('/api/runningbots');
    const data = await res.json();
    runningBotsCache = data.running || [];
    // Bot checkboxes
    activeBotsSelect.innerHTML = runningBotsCache.length === 0 ? '<div>No bots running.</div>' :
      runningBotsCache.map(b => {
        const botName = b.botFile.split(/[/\\]/).pop();
        return `<label style="display:block;margin-bottom:4px;"><input type="checkbox" class="active-bot-cb" value="${b.pid}"> ${botName} (PID: ${b.pid})</label>`;
      }).join('');
    // Task dropdown
    let taskOptions = availableTasks.map(t => `<option value="${t}">${t}</option>`).join('');
    if (!taskOptions) taskOptions = '<option value="">No tasks found</option>';
    activeBotsSelect.innerHTML += `<div style="margin-top:10px;"><label>Task:</label> <select id="activeTaskSelect">${taskOptions}</select></div>`;
  }

  // Toggle panel (add null check)
  if (activeBotsToggle && activeBotsControl) {
    activeBotsToggle.onclick = async () => {
      if (activeBotsControl.style.display === 'none') {
        await populateActiveBotsControl();
        activeBotsControl.style.display = '';
        activeBotsToggle.textContent = 'Hide Active Bots Control';
      } else {
        activeBotsControl.style.display = 'none';
        activeBotsToggle.textContent = 'Switch to Active Bots Control';
      }
    };
  }

  // Send to All and Send to Selected logic
  if (sendToAllBtn) {
    sendToAllBtn.onclick = async () => {
      sendTaskResult.textContent = '';
      const taskName = document.getElementById('activeTaskSelect')?.value;
      if (!taskName) {
        sendTaskResult.textContent = 'Please select a task.';
        return;
      }
      try {
        const res = await fetch(`/tasks/${taskName}.json`);
        const task = await res.json();
        const apiRes = await fetch('/api/sendtask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pids: 'all', task })
        });
        const data = await apiRes.json();
        if (data.success) {
          sendTaskResult.textContent = 'Task sent to all running bots.';
        } else {
          sendTaskResult.textContent = 'Failed: ' + (data.error || 'Unknown error');
        }
      } catch (e) {
        sendTaskResult.textContent = 'Error: ' + e.message;
      }
    };
  }
  if (sendToSelectedBtn) {
    sendToSelectedBtn.onclick = async () => {
      sendTaskResult.textContent = '';
      const taskName = document.getElementById('activeTaskSelect')?.value;
      if (!taskName) {
        sendTaskResult.textContent = 'Please select a task.';
        return;
      }
      const checked = Array.from(document.querySelectorAll('.active-bot-cb:checked')).map(cb => Number(cb.value));
      if (checked.length === 0) {
        sendTaskResult.textContent = 'Please select at least one bot.';
        return;
      }
      try {
        const res = await fetch(`/tasks/${taskName}.json`);
        const task = await res.json();
        const apiRes = await fetch('/api/sendtask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pids: checked, task })
        });
        const data = await apiRes.json();
        if (data.success) {
          sendTaskResult.textContent = 'Task sent to selected bots.';
        } else {
          sendTaskResult.textContent = 'Failed: ' + (data.error || 'Unknown error');
        }
      } catch (e) {
        sendTaskResult.textContent = 'Error: ' + e.message;
      }
    };
  }

  // --- Chain of Tasks Builder ---
  const chainNameInput = document.getElementById('chainName');
  const stepsList = document.getElementById('stepsList');
  const chainAddStepBtn = document.getElementById('chainAddStepBtn');
  const chainPreview = document.getElementById('chainPreview');

  let steps = [];

  function renderSteps() {
    stepsList.innerHTML = '';
    steps.forEach((step, i) => {
      const stepDiv = document.createElement('div');
      stepDiv.className = 'step-block';
      stepDiv.style = 'border:1px solid #444;padding:10px;margin-bottom:10px;border-radius:6px;background:#181818;';
      stepDiv.innerHTML = `
        <div style="display:flex;gap:10px;">
          <div style="flex:2;">
            <label>Step ${i + 1} - URL:</label>
            <input type="text" class="step-url" value="${step.url || ''}" placeholder="https://example.com" style="width:100%;" required />
          </div>
          <div style="flex:1;">
            <label>Min Wait After Nav (s):</label>
            <input type="number" class="step-minwait" value="${step.minWaitAfterNav || 2}" min="0" step="0.1" style="width:100%;" />
          </div>
          <div style="flex:1;">
            <label>Max Wait After Nav (s):</label>
            <input type="number" class="step-maxwait" value="${step.maxWaitAfterNav || 5}" min="0" step="0.1" style="width:100%;" />
          </div>
          <button type="button" class="remove-step-btn" style="margin-top:22px;">Remove Step</button>
        </div>
        <div class="actions-list" style="margin-top:10px;"></div>
        <button type="button" class="add-action-btn action-btn" style="margin-top:5px;">Add Action</button>
      `;
      // Remove step
      stepDiv.querySelector('.remove-step-btn').onclick = () => {
        steps.splice(i, 1);
        renderSteps();
        renderChainPreview();
      };
      // Add action
      stepDiv.querySelector('.add-action-btn').onclick = () => {
        step.actions.push({ type: 'pop-under-click', value: '', minWait: 1, maxWait: 2 });
        renderSteps();
        renderChainPreview();
      };
      // Render actions
      const actionsListDiv = stepDiv.querySelector('.actions-list');
      step.actions.forEach((action, j) => {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-row';
        actionDiv.style = 'display:flex;gap:10px;margin-bottom:5px;';
        actionDiv.innerHTML = `
          <select class="action-type">
            <option value="pop-under-click"${action.type === 'pop-under-click' ? ' selected' : ''}>Pop Under Click</option>
            <option value="click-xpath"${action.type === 'click-xpath' ? ' selected' : ''}>Click XPath</option>
            <option value="click-similar-links"${action.type === 'click-similar-links' ? ' selected' : ''}>Click Similar Links</option>
          </select>
          <input type="text" class="action-value" value="${action.value || ''}" placeholder="Value/XPath/Text" style="flex:2;" />
          <input type="number" class="min-wait" value="${action.minWait || 1}" min="0" step="0.1" style="width:80px;" placeholder="Min Wait" />
          <input type="number" class="max-wait" value="${action.maxWait || 2}" min="0" step="0.1" style="width:80px;" placeholder="Max Wait" />
          <button type="button" class="remove-action-btn">Remove</button>
        `;
        // Remove action
        actionDiv.querySelector('.remove-action-btn').onclick = () => {
          step.actions.splice(j, 1);
          renderSteps();
          renderChainPreview();
        };
        // Action type/value/min/max change
        actionDiv.querySelector('.action-type').onchange = e => { action.type = e.target.value; renderChainPreview(); };
        actionDiv.querySelector('.action-value').oninput = e => { action.value = e.target.value; renderChainPreview(); };
        actionDiv.querySelector('.min-wait').oninput = e => { action.minWait = parseFloat(e.target.value) || 0; renderChainPreview(); };
        actionDiv.querySelector('.max-wait').oninput = e => { action.maxWait = parseFloat(e.target.value) || 0; renderChainPreview(); };
        actionsListDiv.appendChild(actionDiv);
      });
      // Step URL/min/max change
      stepDiv.querySelector('.step-url').oninput = e => { step.url = e.target.value; renderChainPreview(); };
      stepDiv.querySelector('.step-minwait').oninput = e => { step.minWaitAfterNav = parseFloat(e.target.value) || 0; renderChainPreview(); };
      stepDiv.querySelector('.step-maxwait').oninput = e => { step.maxWaitAfterNav = parseFloat(e.target.value) || 0; renderChainPreview(); };
      stepsList.appendChild(stepDiv);
    });
  }

  function renderChainPreview() {
    const chain = {
      name: chainNameInput.value.trim(),
      steps: steps.map(s => ({
        url: s.url,
        minWaitAfterNav: s.minWaitAfterNav,
        maxWaitAfterNav: s.maxWaitAfterNav,
        actions: s.actions.map(a => ({ ...a }))
      }))
    };
    chainPreview.textContent = JSON.stringify(chain, null, 2);
  }

  if (chainAddStepBtn) {
    chainAddStepBtn.onclick = () => {
      steps.push({
        url: '',
        minWaitAfterNav: 2,
        maxWaitAfterNav: 5,
        actions: []
      });
      renderSteps();
      renderChainPreview();
    };
  }

  // Initial render
  renderSteps();
  renderChainPreview();

  // Form submit
  createTaskForm.onsubmit = async e => {
    e.preventDefault();
    createTaskSuccess.style.display = 'none';
    const name = chainNameInput.value.trim();
    if (!name || steps.length === 0 || steps.some(s => !s.url || s.actions.length === 0)) {
      alert('Please fill all step URLs and add at least one action per step.');
      return;
    }
    const chain = {
      name,
      steps: steps.map(s => ({
        url: s.url,
        minWaitAfterNav: s.minWaitAfterNav,
        maxWaitAfterNav: s.maxWaitAfterNav,
        actions: s.actions.map(a => ({ ...a }))
      }))
    };
    try {
      const res = await fetch('/api/createtask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chain)
      });
      const data = await res.json();
      if (data.success) {
        createTaskSuccess.textContent = 'Chain saved!';
        createTaskSuccess.style.display = 'block';
        steps = [];
        chainNameInput.value = '';
        renderSteps();
        renderChainPreview();
      } else {
        alert('Failed to save chain: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error saving chain: ' + e.message);
    }
  };

  // --- Task Deletion UI ---
  const deleteTaskBtn = document.createElement('button');
  deleteTaskBtn.id = 'deleteTaskBtn';
  deleteTaskBtn.textContent = 'Delete Selected Task';
  deleteTaskBtn.className = 'action-btn';
  deleteTaskBtn.style.background = '#e53e3e';
  deleteTaskBtn.style.marginTop = '10px';
  createTaskMenu.appendChild(deleteTaskBtn);

  deleteTaskBtn.onclick = async () => {
    const name = chainNameInput.value.trim();
    if (!name) {
      alert('Enter the name of the task/chain to delete.');
      return;
    }
    if (!confirm(`Are you sure you want to delete the task/chain '${name}'?`)) return;
    try {
      const res = await fetch('/api/deletetask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        alert('Task deleted successfully.');
        steps = [];
        chainNameInput.value = '';
        renderSteps();
        renderChainPreview();
      } else {
        alert('Failed to delete task: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error deleting task: ' + e.message);
    }
  };

  // --- Orderly Launch menu logic ---
  async function updateOrderlyFamilies() {
    const res = await fetch('/api/botinfo');
    const info = await res.json();
    orderlyBotFamilySelect.innerHTML = '<option value="random">Random (any family)</option>';
    info.families.forEach(fam => {
      const opt = document.createElement('option');
      opt.value = fam;
      opt.textContent = fam;
      orderlyBotFamilySelect.appendChild(opt);
    });
    updateOrderlyBots();
  }

  orderlyBotFamilySelect.addEventListener('change', updateOrderlyBots);

  async function updateOrderlyBots() {
    const fam = orderlyBotFamilySelect.value;
    orderlyBotSelect.innerHTML = '<option value="random">Random (any bot in selected family)</option>';
    if (fam === 'random') return;
    // Fetch bots in family from backend
    const res = await fetch(`/api/botinfo?family=${encodeURIComponent(fam)}`);
    const info = await res.json();
    (info.bots || []).forEach(bot => {
      const opt = document.createElement('option');
      opt.value = bot.file;
      opt.textContent = bot.name;
      orderlyBotSelect.appendChild(opt);
    });
  }

  async function updateOrderlyTaskChains() {
    const res = await fetch('/api/listtasks');
    const info = await res.json();
    orderlyTaskChainSelect.innerHTML = '';
    (info.tasks || []).forEach(task => {
      const opt = document.createElement('option');
      opt.value = task;
      opt.textContent = task;
      orderlyTaskChainSelect.appendChild(opt);
    });
  }

  orderlyLaunchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    orderlyLaunchLog.textContent = 'Launching...';
    const family = orderlyBotFamilySelect.value;
    const bot = orderlyBotSelect.value;
    const taskChain = orderlyTaskChainSelect.value;
    const useLocalNetwork = orderlyUseLocalNetwork.checked;
    let steps = [];
    try {
      const resp = await fetch(`/tasks/${taskChain}.json`);
      steps = await resp.json();
    } catch (err) {
      orderlyLaunchLog.textContent = 'Failed to load task chain: ' + err;
      return;
    }
    // Prepare launch params
    const params = {
      family: family === 'random' ? undefined : family,
      bot: bot === 'random' ? undefined : bot,
      steps,
      useLocalNetwork,
      randomize: false // Orderly execution
    };
    try {
      const launchResp = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const launchResult = await launchResp.json();
      orderlyLaunchLog.textContent = JSON.stringify(launchResult, null, 2);
    } catch (err) {
      orderlyLaunchLog.textContent = 'Launch failed: ' + err;
    }
  });

  // --- Browser URL management ---
  function setPageUrl(page) {
    const url = page === 'createBot' ? '/create-bot' :
      page === 'launchBot' ? '/launch-bot' :
      page === 'running-bots' ? '/running-bots' :
      page === 'createTask' ? '/create-task' :
      page === 'autoLaunch' ? '/auto-launch' :
      page === 'orderlyLaunch' ? '/orderly-launch' : '/';
    if (window.location.pathname !== url) {
      window.history.pushState({}, '', url);
    }
  }

  // On page load, show the correct section based on the URL
  function showSectionFromUrl() {
    const path = window.location.pathname;
    if (path === '/create-bot') createBotMenuBtn.click();
    else if (path === '/launch-bot') launchBotMenuBtn.click();
    else if (path === '/running-bots') runningBotsMenuBtn.click();
    else if (path === '/create-task') createTaskMenuBtn.click();
    else if (path === '/auto-launch') autoLaunchMenuBtn.click();
    else if (path === '/orderly-launch') orderlyLaunchMenuBtn.click();
    else createBotMenuBtn.click();
  }
  showSectionFromUrl();
});

if (window.location.pathname === '/' && window.location.search === '?') {
  window.history.replaceState({}, document.title, '/');
}
