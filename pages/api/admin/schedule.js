import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

// Check if current user is admin
const isAdmin = (email) => {
  const adminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
  return adminEmails.includes(email);
};

import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// Default schedule settings
const defaultSchedule = {
  enabled: false,
  day: 'Monday',
  hour: 10,
  timezone: 'America/New_York'
};

// Read schedule settings from Notion
const readScheduleSettings = async () => {
  try {
    const databaseId = process.env.NOTION_SETTINGS_DATABASE_ID;
    if (!databaseId) {
      console.log('No settings database ID found, using defaults');
      return defaultSchedule;
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 1
    });

    if (response.results.length === 0) {
      console.log('No settings found in database, using defaults');
      return defaultSchedule;
    }

    const page = response.results[0];
    const properties = page.properties;

    const settings = {
      enabled: properties.enabled?.checkbox ?? defaultSchedule.enabled,
      day: properties.day?.select?.name ?? defaultSchedule.day,
      hour: properties.hour?.number ?? defaultSchedule.hour,
      timezone: properties.timezone?.select?.name ?? defaultSchedule.timezone
    };

    console.log('Schedule settings loaded from Notion:', settings);
    return settings;
  } catch (error) {
    console.error('Error reading schedule settings from Notion:', error);
    return defaultSchedule;
  }
};

// Write schedule settings to Notion
const writeScheduleSettings = async (settings) => {
  try {
    const databaseId = process.env.NOTION_SETTINGS_DATABASE_ID;
    if (!databaseId) {
      console.error('No settings database ID configured');
      return false;
    }

    // Get the first (and should be only) page in the database
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 1
    });

    let pageId;
    if (response.results.length > 0) {
      // Update existing page
      pageId = response.results[0].id;
    } else {
      // Create new page if none exists
      const createResponse = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          'Name': {
            title: [{ text: { content: 'Schedule Settings' } }]
          }
        }
      });
      pageId = createResponse.id;
    }

    // Update the page with new settings
    await notion.pages.update({
      page_id: pageId,
      properties: {
        enabled: { checkbox: settings.enabled },
        day: { select: { name: settings.day } },
        hour: { number: settings.hour },
        timezone: { select: { name: settings.timezone } }
      }
    });

    console.log('Schedule settings saved to Notion:', settings);
    return true;
  } catch (error) {
    console.error('Error writing schedule settings to Notion:', error);
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
      const settings = await readScheduleSettings();
      return res.status(200).json(settings);
    }

    if (req.method === 'POST') {
      // Update schedule settings
      const { enabled, day, hour, timezone } = req.body;

      // Validate input
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!validDays.includes(day)) {
        return res.status(400).json({ error: 'Invalid day of week' });
      }

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Enabled must be a boolean value' });
      }

      if (typeof hour !== 'number' || hour < 0 || hour > 23) {
        return res.status(400).json({ error: 'Hour must be a number between 0 and 23' });
      }

      const validTimezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC'];
      if (!validTimezones.includes(timezone)) {
        return res.status(400).json({ error: 'Invalid timezone' });
      }

      const newSettings = { enabled, day, hour, timezone };
      
      if (await writeScheduleSettings(newSettings)) {
        return res.status(200).json({ 
          success: true, 
          message: 'Schedule settings saved successfully to Notion!',
          settings: newSettings
        });
      } else {
        return res.status(500).json({ error: 'Failed to save schedule settings to Notion' });
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
export const getCurrentSchedule = async () => {
  return await readScheduleSettings();
};