// Simple persistent storage for progress updates
// Uses global variable that persists across serverless function calls

// Global storage that persists across function invocations
global.progressUpdates = global.progressUpdates || {};

export function getProgressUpdates() {
  return global.progressUpdates;
}

export function setProgressUpdate(goalId, progress, goalTitle) {
  global.progressUpdates[goalId] = {
    progress,
    updatedAt: new Date().toISOString(),
    goalTitle
  };
  
  console.log(`Progress stored: ${goalTitle} -> ${progress}%`);
  return global.progressUpdates[goalId];
}

export function getAllUpdates() {
  return global.progressUpdates;
}