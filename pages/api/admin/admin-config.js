import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'config', 'admin-config.json');

// Default admin configuration
const DEFAULT_CONFIG = {
  adminEmails: ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'],
  atRiskThreshold: 15, // percentage points behind expected progress
  checkInTime: {
    hour: 10, // 10 AM
    timezone: 'America/New_York'
  },
  smartGoalsGuidance: `📋 **Key Results Best Practices**
Write SMART Key Results that are:
• **Specific**: Clear and well-defined outcomes, not vague statements
• **Measurable**: Include numbers, percentages, or quantifiable metrics  
• **Achievable**: Realistic given your resources and timeline
• **Relevant**: Directly supports your goal and company priorities
• **Time-bound**: Set clear deadlines (by end of quarter, by March 31st, etc.)

Good example: "Launch 3 new features by March 31st"
Avoid: "Work on new features"`
};

function ensureConfigDirectory() {
  const configDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function getAdminConfig() {
  try {
    ensureConfigDirectory();
    
    if (!fs.existsSync(CONFIG_FILE)) {
      // Create default config file if it doesn't exist
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    
    const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
    const existingConfig = JSON.parse(configData);
    
    // Merge with defaults to ensure all fields are present
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...existingConfig,
      // Handle nested objects properly
      checkInTime: {
        ...DEFAULT_CONFIG.checkInTime,
        ...existingConfig.checkInTime
      }
    };
    
    return mergedConfig;
  } catch (error) {
    console.error('Error reading admin config:', error);
    return DEFAULT_CONFIG;
  }
}

function saveAdminConfig(config) {
  try {
    ensureConfigDirectory();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving admin config:', error);
    return false;
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const config = getAdminConfig();
    res.status(200).json(config);
  } else if (req.method === 'POST') {
    try {
      const newConfig = req.body;
      
      // Basic validation
      if (!newConfig.adminEmails || !Array.isArray(newConfig.adminEmails)) {
        return res.status(400).json({ error: 'adminEmails must be an array' });
      }
      
      // Validate email formats
      for (const email of newConfig.adminEmails) {
        if (!isValidEmail(email)) {
          return res.status(400).json({ error: `Invalid email format: ${email}` });
        }
      }
      
      // Validate at-risk threshold
      if (newConfig.atRiskThreshold && 
          (typeof newConfig.atRiskThreshold !== 'number' || 
           newConfig.atRiskThreshold < 0 || 
           newConfig.atRiskThreshold > 100)) {
        return res.status(400).json({ error: 'atRiskThreshold must be a number between 0 and 100' });
      }
      
      // Validate check-in time
      if (newConfig.checkInTime) {
        if (typeof newConfig.checkInTime.hour !== 'number' || 
            newConfig.checkInTime.hour < 0 || 
            newConfig.checkInTime.hour > 23) {
          return res.status(400).json({ error: 'checkInTime.hour must be a number between 0 and 23' });
        }
      }
      
      // Validate SMART goals guidance
      if (newConfig.smartGoalsGuidance !== undefined && typeof newConfig.smartGoalsGuidance !== 'string') {
        return res.status(400).json({ error: 'smartGoalsGuidance must be a string' });
      }
      
      const success = saveAdminConfig(newConfig);
      if (success) {
        res.status(200).json({ message: 'Admin configuration saved successfully' });
      } else {
        res.status(500).json({ error: 'Failed to save configuration' });
      }
    } catch (error) {
      console.error('Error processing admin config:', error);
      res.status(500).json({ error: 'Invalid request body' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Export helper function for other modules to use
export { getAdminConfig };