import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

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
  if (req.method !== 'PUT') {
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
  const { id } = req.query;
  const { primaryRole, capacity, competency, desire, secondaryRole, capacity2, competency2, desire2, discussion } = req.body;

  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  if (!id) {
    return res.status(400).json({ error: 'Person ID is required' });
  }

  try {
    // Build the properties object for updating
    const properties = {};

    if (primaryRole !== undefined) {
      properties['Primary Role'] = {
        rich_text: [{ text: { content: primaryRole || '' } }]
      };
    }

    if (capacity !== undefined) {
      properties['Capacity'] = {
        select: capacity ? { name: capacity } : null
      };
    }

    if (competency !== undefined) {
      properties['Competency'] = {
        select: competency ? { name: competency } : null
      };
    }

    if (desire !== undefined) {
      properties['Desire'] = {
        select: desire ? { name: desire } : null
      };
    }

    if (secondaryRole !== undefined) {
      properties['Secondary Role'] = {
        rich_text: [{ text: { content: secondaryRole || '' } }]
      };
    }

    if (capacity2 !== undefined) {
      properties['Capacity2'] = {
        select: capacity2 ? { name: capacity2 } : null
      };
    }

    if (competency2 !== undefined) {
      properties['Competency2'] = {
        select: competency2 ? { name: competency2 } : null
      };
    }

    if (desire2 !== undefined) {
      properties['Desire2'] = {
        select: desire2 ? { name: desire2 } : null
      };
    }

    if (discussion !== undefined) {
      properties['Discussion'] = {
        rich_text: [{ text: { content: discussion || '' } }]
      };
    }

    // Add Last Updated with date and time
    properties['Last Updated'] = {
      date: {
        start: new Date().toISOString() // Full ISO timestamp with date and time
      }
    };

    // Get the user's Notion ID from employee configuration
    try {
      const employeeResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/employees`);
      if (employeeResponse.ok) {
        const employeeConfig = await employeeResponse.json();
        const employees = employeeConfig.employees; // Extract the employees array
        const currentUser = employees.find(emp => emp.email === session.user.email);
        
        console.log('Current session user email:', session.user.email);
        console.log('Employee config:', employeeConfig);
        console.log('Found current user:', currentUser);
        
        if (currentUser && currentUser.notionUserId) {
          // Add Updated By as proper Notion user
          properties['Updated By'] = {
            people: [{ id: currentUser.notionUserId }]
          };
          console.log('Setting Updated By to:', currentUser.notionUserId);
        } else {
          console.log('No matching user found or missing notionUserId');
        }
      } else {
        console.log('Employee API response not ok:', employeeResponse.status);
      }
    } catch (error) {
      console.error('Error getting employee config for Updated By:', error);
      // Skip Updated By field if we can't get the proper Notion user ID
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        properties
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Notion API error:', response.status, errorData);
      return res.status(response.status).json({ 
        error: 'Failed to update person in Notion',
        details: errorData 
      });
    }

    const updatedPage = await response.json();
    
    res.status(200).json({ 
      success: true, 
      message: 'Person updated successfully',
      id: updatedPage.id
    });
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}