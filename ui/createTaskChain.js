// createTaskChain.js
// Handles the chain-of-tasks builder UI logic for the Create Task page only

document.addEventListener('DOMContentLoaded', () => {
  const chainNameInput = document.getElementById('chainName');
  const stepsList = document.getElementById('stepsList');
  const chainAddStepBtn = document.getElementById('chainAddStepBtn');
  const chainPreview = document.getElementById('chainPreview');
  const createTaskForm = document.getElementById('createTaskForm');
  const createTaskSuccess = document.getElementById('createTaskSuccess');

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
});
