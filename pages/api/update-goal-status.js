export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { goalId, status } = req.body;

  if (!goalId || !status) {
    return res.status(400).json({ error: 'Goal ID and status are required' });
  }

  const notionToken = process.env.NOTION_TOKEN;

  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  try {
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

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Notion API Error ${response.status}: ${errorData}`);
    }

    const updatedPage = await response.json();
    
    res.status(200).json({ 
      success: true, 
      status: updatedPage.properties.Status?.status?.name || status 
    });
  } catch (error) {
    console.error('Error updating goal status:', error);
    res.status(500).json({ error: error.message });
  }
}