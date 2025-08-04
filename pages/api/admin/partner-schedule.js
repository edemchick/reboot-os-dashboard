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

// Default partner schedule settings  
const defaultPartnerSchedule = {
  enabled: false,
  day: 'Friday'
};

// Read partner schedule settings from Notion
const readPartnerScheduleSettings = async () => {
  try {
    const databaseId = process.env.NOTION_PARTNER_SETTINGS_DATABASE_ID;
    if (!databaseId) {
      console.log('No partner settings database ID found, using defaults');
      return defaultPartnerSchedule;
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 1
    });

    if (response.results.length === 0) {
      console.log('No partner settings found in database, using defaults');
      return defaultPartnerSchedule;
    }

    const page = response.results[0];
    const properties = page.properties;

    const settings = {
      enabled: properties.enabled?.checkbox ?? defaultPartnerSchedule.enabled,
      day: properties.day?.select?.name ?? defaultPartnerSchedule.day
    };

    console.log('Partner schedule settings loaded from Notion:', settings);
    return settings;
  } catch (error) {
    console.error('Error reading partner schedule settings from Notion:', error);
    return defaultPartnerSchedule;
  }
};

// Write partner schedule settings to Notion
const writePartnerScheduleSettings = async (settings) => {
  try {
    const databaseId = process.env.NOTION_PARTNER_SETTINGS_DATABASE_ID;
    if (!databaseId) {
      console.error('No partner settings database ID configured');
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
        day: { select: { name: settings.day } }
      }
    });

    console.log('Partner schedule settings saved to Notion:', settings);
    return true;
  } catch (error) {
    console.error('Error writing partner schedule settings to Notion:', error);
    return false;
  }
};

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check admin access
    if (!isAdmin(session.user.email)) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    if (req.method === 'GET') {
      // Return current partner schedule settings
      const settings = await readPartnerScheduleSettings();
      return res.status(200).json(settings);
    }
    
    if (req.method === 'POST') {
      // Update partner schedule settings
      const { enabled, day } = req.body;
      
      if (typeof enabled !== 'boolean' || typeof day !== 'string') {
        return res.status(400).json({ error: 'Invalid settings format' });
      }

      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!validDays.includes(day)) {
        return res.status(400).json({ error: 'Invalid day specified' });
      }

      const success = await writePartnerScheduleSettings({ enabled, day });
      
      if (success) {
        return res.status(200).json({ message: 'Partner schedule settings updated successfully' });
      } else {
        return res.status(500).json({ error: 'Failed to update partner schedule settings' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin partner schedule API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}