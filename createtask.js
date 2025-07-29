// createtask.js
// Handles saving both single-step and chain-of-tasks formats
const fs = require('fs');
const path = require('path');

function saveTask(task, tasksDir) {
  if (!task || !task.name) throw new Error('Missing task name');
  const safeName = task.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(tasksDir, safeName + '.json');
  // Accept both {name, url, actions} and {name, steps}
  let toSave;
  if (Array.isArray(task.steps)) {
    // Chain-of-tasks format
    toSave = {
      name: task.name,
      steps: task.steps.map(s => ({
        url: s.url,
        minWaitAfterNav: s.minWaitAfterNav,
        maxWaitAfterNav: s.maxWaitAfterNav,
        actions: Array.isArray(s.actions) ? s.actions.map(a => ({ ...a })) : []
      }))
    };
  } else if (task.url && Array.isArray(task.actions)) {
    // Single-step format
    toSave = {
      name: task.name,
      url: task.url,
      minWaitAfterNav: task.minWaitAfterNav,
      maxWaitAfterNav: task.maxWaitAfterNav,
      actions: task.actions.map(a => ({ ...a }))
    };
  } else {
    throw new Error('Invalid task format');
  }
  fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2));
}

module.exports = saveTask;
