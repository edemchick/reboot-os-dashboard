import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const CONFIG_FILE = path.join(process.cwd(), 'config', 'prep-checklist.json');

// Default checklist configuration
const DEFAULT_CONFIG = {
  Q1: {
    reviewPreviousQuarter: false,
    analyzeMetrics: false,
    identifyImprovements: false,
    setNewGoals: false,
    planResources: false,
    discussHiringNeeds: false,
    scheduleReviews: false,
    communicateChanges: false
  },
  Q2: {
    reviewPreviousQuarter: false,
    analyzeMetrics: false,
    identifyImprovements: false,
    setNewGoals: false,
    planResources: false,
    discussHiringNeeds: false,
    scheduleReviews: false,
    communicateChanges: false
  },
  Q3: {
    reviewPreviousQuarter: false,
    analyzeMetrics: false,
    identifyImprovements: false,
    setNewGoals: false,
    planResources: false,
    discussHiringNeeds: false,
    scheduleReviews: false,
    communicateChanges: false
  },
  Q4: {
    reviewPreviousQuarter: false,
    analyzeMetrics: false,
    identifyImprovements: false,
    setNewGoals: false,
    planResources: false,
    discussHiringNeeds: false,
    scheduleReviews: false,
    communicateChanges: false
  }
};

function ensureConfigDirectory() {
  const configDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function getPrepChecklistConfig() {
  try {
    ensureConfigDirectory();
    
    if (!fs.existsSync(CONFIG_FILE)) {
      // Create default config file if it doesn't exist
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    
    const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(configData);
    
    // Ensure all required quarters exist
    const completeConfig = { ...DEFAULT_CONFIG };
    Object.keys(DEFAULT_CONFIG).forEach(quarter => {
      if (config[quarter]) {
        completeConfig[quarter] = { ...DEFAULT_CONFIG[quarter], ...config[quarter] };
      }
    });
    
    return completeConfig;
  } catch (error) {
    console.error('Error reading prep checklist config:', error);
    return DEFAULT_CONFIG;
  }
}

function savePrepChecklistConfig(config) {
  try {
    ensureConfigDirectory();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving prep checklist config:', error);
    return false;
  }
}

// Check if current user is admin
const isAdmin = (email) => {
  const fallbackAdminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
  
  try {
    if (fs.existsSync(path.join(process.cwd(), 'config', 'admin-config.json'))) {
      const adminConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config', 'admin-config.json'), 'utf8'));
      if (adminConfig.adminEmails && Array.isArray(adminConfig.adminEmails)) {
        return adminConfig.adminEmails.includes(email);
      }
    }
  } catch (error) {
    console.error('Error reading admin config:', error);
  }
  
  return fallbackAdminEmails.includes(email);
};

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check admin access
  if (!isAdmin(session.user.email)) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    if (req.method === 'GET') {
      const config = getPrepChecklistConfig();
      res.status(200).json(config);
    } else if (req.method === 'POST') {
      const { quarter, itemKey, checked } = req.body;
      
      if (!quarter || !itemKey || typeof checked !== 'boolean') {
        return res.status(400).json({ error: 'Invalid request. Quarter, itemKey, and checked status required.' });
      }
      
      const config = getPrepChecklistConfig();
      
      if (!config[quarter]) {
        return res.status(400).json({ error: 'Invalid quarter specified.' });
      }
      
      if (!(itemKey in config[quarter])) {
        return res.status(400).json({ error: 'Invalid checklist item specified.' });
      }
      
      // Update the specific item
      config[quarter][itemKey] = checked;
      
      const success = savePrepChecklistConfig(config);
      if (success) {
        res.status(200).json({ message: 'Checklist updated successfully', config });
      } else {
        res.status(500).json({ error: 'Failed to save checklist configuration' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error processing prep checklist request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export { getPrepChecklistConfig };