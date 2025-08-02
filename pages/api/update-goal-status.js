export default async function handler(req, res) {
  console.log('=== UPDATE GOAL STATUS API CALLED ===');
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { goalId, status } = req.body;
  
  console.log('Extracted values:', { goalId, status });
  
  if (!goalId || !status) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'Goal ID and status are required' });
  }

  const notionToken = process.env.NOTION_TOKEN;
  
  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  try {
    console.log('Making Notion API call to update goal:', goalId, 'with status:', status);
    
    const response = await fetch(`https://api.notion.com/v1/pages/${goalId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        properties: {
          Status: {
            status: {
              name: status
            }
          }
        }
      })
    });

    console.log('Notion API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Notion API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData,
        requestBody: { goalId, status }
      });
      throw new Error(`Notion API Error ${response.status}: ${errorData}`);
    }

    const updatedPage = await response.json();
    
    console.log('✅ Successfully updated goal status in Notion');
    console.log('New status:', updatedPage.properties.Status.status.name);
    
    res.status(200).json({ 
      success: true, 
      status: updatedPage.properties.Status.status.name 
    });
    
  } catch (error) {
    console.error('Error updating goal status:', error);
    res.status(500).json({ error: error.message });
  }
}