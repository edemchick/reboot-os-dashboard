import fs from 'fs';
import path from 'path';

// Use a persistent file location that works in Vercel
const getStorageFile = () => {
  // In Vercel, use /tmp but with a backup strategy
  return '/tmp/progress-updates.json';
};

// Backup storage in case file system fails
let memoryBackup = {};

export function getProgressUpdates() {
  try {
    const filePath = getStorageFile();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const updates = JSON.parse(data);
      console.log('Loaded progress from file:', Object.keys(updates).length, 'updates');
      return updates;
    }
  } catch (error) {
    console.error('Error reading from file, using memory backup:', error);
  }
  
  console.log('Using memory backup:', Object.keys(memoryBackup).length, 'updates');
  return memoryBackup;
}

export function setProgressUpdate(goalId, progress, goalTitle) {
  const update = {
    progress,
    updatedAt: new Date().toISOString(),
    goalTitle
  };
  
  // Store in memory backup first
  memoryBackup[goalId] = update;
  
  // Try to store in file
  try {
    const filePath = getStorageFile();
    const currentData = getProgressUpdates();
    currentData[goalId] = update;
    
    fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));
    console.log(`Progress stored to file: ${goalTitle} -> ${progress}%`);
  } catch (error) {
    console.error('Error writing to file, stored in memory only:', error);
  }
  
  return update;
}

export function getAllUpdates() {
  return getProgressUpdates();
}