// deletetask.js
// Deletes a task JSON file by name from the tasks directory
const fs = require('fs');
const path = require('path');

module.exports = function deleteTask(name, tasksDir) {
  if (!name) throw new Error('Missing task name');
  const file = path.join(tasksDir, name + '.json');
  if (!fs.existsSync(file)) throw new Error('Task not found');
  fs.unlinkSync(file);
};
