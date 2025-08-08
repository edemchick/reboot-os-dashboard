import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

// Function to check admin access
async function checkAdminAccess(email) {
  if (!email) return false;
  
  try {
    const adminConfigDbId = process.env.NOTION_SETTINGS_DATABASE_ID;
    const notionToken = process.env.NOTION_TOKEN;
    
    if (!adminConfigDbId || !notionToken) {
      // Fallback to hardcoded admin emails
      const fallbackAdminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
      return fallbackAdminEmails.includes(email);
    }

    const response = await fetch(`https://api.notion.com/v1/databases/${adminConfigDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: {
          property: "Type",
          select: {
            equals: "admin-config"
          }
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.results.length > 0) {
        const adminConfig = data.results[0].properties;
        const adminEmailsProperty = adminConfig['Admin Emails'];
        
        if (adminEmailsProperty?.rich_text) {
          const adminEmailsText = adminEmailsProperty.rich_text
            .map(rt => rt.text?.content || '')
            .join('');
          const adminEmails = adminEmailsText.split(',').map(email => email.trim());
          return adminEmails.includes(email);
        }
      }
    }
  } catch (error) {
    console.error('Error checking admin access:', error);
  }
  
  // Fallback to hardcoded admin emails if config fails
  const fallbackAdminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
  return fallbackAdminEmails.includes(email);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if user is authenticated
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  const isAdmin = await checkAdminAccess(session.user.email);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const notionToken = process.env.NOTION_TOKEN;
  const peopleDbId = process.env.NOTION_PEOPLE_DATABASE_ID;

  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  if (!peopleDbId) {
    return res.status(500).json({ error: 'People database ID not configured' });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${peopleDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Notion API error:', response.status, errorData);
      return res.status(response.status).json({ 
        error: 'Failed to fetch people from Notion',
        details: errorData 
      });
    }

    const data = await response.json();
    
    // Transform the data to extract the properties we need
    const people = data.results.reverse().map(page => {
      const properties = page.properties;
      
      // Extract Core Values from rollup formula
      let coreValues = '';
      const coreValuesProperty = properties['Core Values'];
      
      if (coreValuesProperty?.rollup?.array && Array.isArray(coreValuesProperty.rollup.array)) {
        // Handle rollup with formula that returns string
        const firstItem = coreValuesProperty.rollup.array[0];
        if (firstItem?.formula?.string) {
          coreValues = firstItem.formula.string;
        }
      } else if (coreValuesProperty?.formula?.string) {
        // Handle direct formula string
        coreValues = coreValuesProperty.formula.string;
      } else if (coreValuesProperty?.formula?.number !== undefined) {
        // Handle direct formula number
        coreValues = coreValuesProperty.formula.number.toString();
      }
      
      const secondaryRoleText = properties['Secondary Role']?.rich_text?.[0]?.text?.content || '';
      
      return {
        id: page.id,
        name: properties['Name']?.title?.[0]?.text?.content || 'Untitled',
        title: properties['Title']?.rich_text?.[0]?.text?.content || 'Not assigned',
        status: properties['Status']?.select?.name || 'Active',
        lastUpdated: properties['Last Updated']?.date?.start || null,
        coreValues: coreValues,
        primaryRole: properties['Primary Role']?.rich_text?.[0]?.text?.content || 'Not assigned',
        capacity: properties['Capacity']?.select?.name || 'Not rated',
        competency: properties['Competency']?.select?.name || 'Not rated',
        desire: properties['Desire']?.select?.name || 'Not rated',
        secondaryRole: secondaryRoleText,
        capacity2: properties['Capacity2']?.select?.name || '',
        competency2: properties['Competency2']?.select?.name || '',
        desire2: properties['Desire2']?.select?.name || '',
        discussion: properties['Discussion']?.rich_text?.[0]?.text?.content || '',
        updatedBy: properties['Updated By']?.people?.[0]?.name || ''
      };
    });

    res.status(200).json(people);
  } catch (error) {
    console.error('Error fetching people:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}