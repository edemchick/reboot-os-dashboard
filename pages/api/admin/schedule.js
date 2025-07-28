import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import fs from 'fs';
import path from 'path';

// Simple file-based storage for schedule settings
const SCHEDULE_FILE = path.join(process.cwd(), 'data', 'schedule.json');

// Ensure data directory exists
const ensureDataDir = () => {
  const dataDir = path.dirname(SCHEDULE_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Check if current user is admin
const isAdmin = (email) => {
  const adminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
  return adminEmails.includes(email);
};

// Default schedule settings
const defaultSchedule = {
  day: 'Monday',
  time: '09:00',
  enabled: false
};

// Read schedule settings from file
const readScheduleSettings = () => {
  ensureDataDir();
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      const data = fs.readFileSync(SCHEDULE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading schedule file:', error);
  }
  return defaultSchedule;
};

// Write schedule settings to file
const writeScheduleSettings = (settings) => {
  ensureDataDir();
  try {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing schedule file:', error);
    return false;
  }
};

export default async function handler(req, res) {
  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check admin access
    if (!isAdmin(session.user.email)) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    if (req.method === 'GET') {
      // Return current schedule settings
      const settings = readScheduleSettings();
      return res.status(200).json(settings);
    }

    if (req.method === 'POST') {
      // Update schedule settings
      const { day, time, enabled } = req.body;

      // Validate input
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!validDays.includes(day)) {
        return res.status(400).json({ error: 'Invalid day of week' });
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({ error: 'Invalid time format. Use HH:MM format.' });
      }

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Enabled must be a boolean value' });
      }

      const newSettings = { day, time, enabled };
      
      if (writeScheduleSettings(newSettings)) {
        return res.status(200).json({ 
          success: true, 
          message: 'Schedule settings updated successfully',
          settings: newSettings
        });
      } else {
        return res.status(500).json({ error: 'Failed to save schedule settings' });
      }
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Admin schedule API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export function to get current schedule (for use by other parts of the app)
export const getCurrentSchedule = () => {
  return readScheduleSettings();
};