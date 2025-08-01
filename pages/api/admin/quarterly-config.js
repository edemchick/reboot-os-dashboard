import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'config', 'quarterly-dates.json');

// Default quarterly configuration
const DEFAULT_CONFIG = {
  quarters: {
    Q1: { start: { month: 1, day: 11 }, end: { month: 4, day: 10 } },
    Q2: { start: { month: 4, day: 11 }, end: { month: 7, day: 10 } },
    Q3: { start: { month: 7, day: 11 }, end: { month: 10, day: 10 } },
    Q4: { start: { month: 10, day: 11 }, end: { month: 1, day: 10, nextYear: true } }
  }
};

function ensureConfigDirectory() {
  const configDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function getQuarterlyConfig() {
  try {
    ensureConfigDirectory();
    
    if (!fs.existsSync(CONFIG_FILE)) {
      // Create default config file if it doesn't exist
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    
    const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error reading quarterly config:', error);
    return DEFAULT_CONFIG;
  }
}

function saveQuarterlyConfig(config) {
  try {
    ensureConfigDirectory();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving quarterly config:', error);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const config = getQuarterlyConfig();
    res.status(200).json(config);
  } else if (req.method === 'POST') {
    try {
      const newConfig = req.body;
      
      // Basic validation
      if (!newConfig.quarters || typeof newConfig.quarters !== 'object') {
        return res.status(400).json({ error: 'Invalid configuration format' });
      }
      
      // Validate each quarter has required fields
      for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        const q = newConfig.quarters[quarter];
        if (!q || !q.start || !q.end || 
            !q.start.month || !q.start.day || 
            !q.end.month || !q.end.day) {
          return res.status(400).json({ 
            error: `Invalid configuration for ${quarter}` 
          });
        }
      }
      
      const success = saveQuarterlyConfig(newConfig);
      if (success) {
        res.status(200).json({ message: 'Configuration saved successfully' });
      } else {
        res.status(500).json({ error: 'Failed to save configuration' });
      }
    } catch (error) {
      console.error('Error processing quarterly config:', error);
      res.status(500).json({ error: 'Invalid request body' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Export helper function for other modules to use
export { getQuarterlyConfig };