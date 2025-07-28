import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

// Check if current user is admin
const isAdmin = (email) => {
  const adminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
  return adminEmails.includes(email);
};

// Default schedule settings - fixed time at 10:00 AM Eastern
const defaultSchedule = {
  day: 'Monday',
  enabled: false
};

// For Vercel, we'll use a simple in-memory storage with environment variable fallback
// In production, you might want to use a database like Vercel KV or similar
let scheduleSettings = null;

// Read schedule settings (from memory or environment variables)
const readScheduleSettings = () => {
  if (scheduleSettings) {
    return scheduleSettings;
  }
  
  try {
    // Try to read from environment variables as fallback
    const envSchedule = {
      day: process.env.SCHEDULE_DAY || defaultSchedule.day,
      enabled: process.env.SCHEDULE_ENABLED === 'true' || defaultSchedule.enabled
    };
    scheduleSettings = envSchedule;
    return envSchedule;
  } catch (error) {
    console.error('Error reading schedule settings:', error);
    return defaultSchedule;
  }
};

// Write schedule settings (to memory)
// Note: This will reset on server restart. For persistence, use a database.
const writeScheduleSettings = (settings) => {
  try {
    scheduleSettings = settings;
    console.log('Schedule settings updated:', settings);
    return true;
  } catch (error) {
    console.error('Error writing schedule settings:', error);
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
      const { day, enabled } = req.body;

      // Validate input
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!validDays.includes(day)) {
        return res.status(400).json({ error: 'Invalid day of week' });
      }

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Enabled must be a boolean value' });
      }

      const newSettings = { day, enabled };
      
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