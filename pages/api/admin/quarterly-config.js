import { Client } from '@notionhq/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// Default quarterly configuration
const DEFAULT_CONFIG = {
  quarters: {
    Q1: { start: { month: 1, day: 11 }, end: { month: 4, day: 10 } },
    Q2: { start: { month: 4, day: 11 }, end: { month: 7, day: 10 } },
    Q3: { start: { month: 7, day: 11 }, end: { month: 10, day: 10 } },
    Q4: { start: { month: 10, day: 11 }, end: { month: 1, day: 10, nextYear: true } }
  }
};

// Check if current user is admin
const isAdmin = (email) => {
  const adminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
  return adminEmails.includes(email);
};

// Read quarterly configuration from Notion
async function getQuarterlyConfig() {
  try {
    const databaseId = process.env.NOTION_SETTINGS_DATABASE_ID;
    if (!databaseId) {
      console.log('No settings database ID found, using defaults');
      return DEFAULT_CONFIG;
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 4
    });

    if (response.results.length === 0) {
      console.log('No quarterly config found in database, using defaults');
      return DEFAULT_CONFIG;
    }

    // Build quarters config from the pages
    const quarters = {};

    for (const page of response.results) {
      const properties = page.properties;

      // Get the title to identify which quarter (Q1_dates, Q2_dates, etc.)
      const titleText = properties.Name?.title?.[0]?.plain_text || '';
      const quarterMatch = titleText.match(/^(Q\d)_dates$/);

      if (!quarterMatch) continue;

      const quarterName = quarterMatch[1]; // Q1, Q2, Q3, or Q4

      // Extract start and end dates
      const startDate = properties['start_date']?.date?.start;
      const endDate = properties['end_date']?.date?.start;

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Check if end date is in next year (for Q4)
        const nextYear = end.getFullYear() > start.getFullYear();

        quarters[quarterName] = {
          start: {
            month: start.getMonth() + 1, // JavaScript months are 0-indexed
            day: start.getDate()
          },
          end: {
            month: end.getMonth() + 1,
            day: end.getDate()
          }
        };

        if (nextYear) {
          quarters[quarterName].end.nextYear = true;
        }
      }
    }

    // Fill in any missing quarters with defaults
    const finalQuarters = {
      Q1: quarters.Q1 || DEFAULT_CONFIG.quarters.Q1,
      Q2: quarters.Q2 || DEFAULT_CONFIG.quarters.Q2,
      Q3: quarters.Q3 || DEFAULT_CONFIG.quarters.Q3,
      Q4: quarters.Q4 || DEFAULT_CONFIG.quarters.Q4
    };

    console.log('Quarterly config loaded from Notion:', finalQuarters);
    return { quarters: finalQuarters };
  } catch (error) {
    console.error('Error reading quarterly config from Notion:', error);
    return DEFAULT_CONFIG;
  }
}

// Write quarterly configuration to Notion
async function saveQuarterlyConfig(config) {
  try {
    const databaseId = process.env.NOTION_SETTINGS_DATABASE_ID;
    if (!databaseId) {
      console.error('No settings database ID configured');
      return false;
    }

    // Get all existing quarter pages
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100
    });

    // Create a map of existing pages by quarter name
    const existingPages = {};
    for (const page of response.results) {
      const titleText = page.properties.Name?.title?.[0]?.plain_text || '';
      const quarterMatch = titleText.match(/^(Q\d)_dates$/);
      if (quarterMatch) {
        existingPages[quarterMatch[1]] = page.id;
      }
    }

    // Update or create each quarter's page
    for (const [quarter, data] of Object.entries(config.quarters)) {
      const startYear = 2026; // Use current year or make this dynamic
      const endYear = data.end.nextYear ? startYear + 1 : startYear;

      const startDate = `${startYear}-${String(data.start.month).padStart(2, '0')}-${String(data.start.day).padStart(2, '0')}`;
      const endDate = `${endYear}-${String(data.end.month).padStart(2, '0')}-${String(data.end.day).padStart(2, '0')}`;

      const properties = {
        'start_date': { date: { start: startDate } },
        'end_date': { date: { start: endDate } }
      };

      if (existingPages[quarter]) {
        // Update existing page
        await notion.pages.update({
          page_id: existingPages[quarter],
          properties
        });
      } else {
        // Create new page
        await notion.pages.create({
          parent: { database_id: databaseId },
          properties: {
            'Name': {
              title: [{ text: { content: `${quarter}_dates` } }]
            },
            ...properties
          }
        });
      }
    }

    console.log('Quarterly config saved to Notion:', config);
    return true;
  } catch (error) {
    console.error('Error writing quarterly config to Notion:', error);
    return false;
  }
}

export default async function handler(req, res) {
  try {
    // Check authentication for POST requests
    if (req.method === 'POST') {
      const session = await getServerSession(req, res, authOptions);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check admin access
      if (!isAdmin(session.user.email)) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }
    }

    if (req.method === 'GET') {
      const config = await getQuarterlyConfig();
      res.status(200).json(config);
    } else if (req.method === 'POST') {
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

      const success = await saveQuarterlyConfig(newConfig);
      if (success) {
        res.status(200).json({ message: 'Configuration saved successfully to Notion!' });
      } else {
        res.status(500).json({ error: 'Failed to save configuration to Notion' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error processing quarterly config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Export helper function for other modules to use
export { getQuarterlyConfig };