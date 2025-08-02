export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { goalId } = req.query;

  if (!goalId) {
    return res.status(400).json({ error: 'Goal ID is required' });
  }

  const notionToken = process.env.NOTION_TOKEN;

  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${goalId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Notion API Error ${response.status}: ${errorData}`);
    }

    const page = await response.json();
    
    res.status(200).json({ 
      success: true,
      goalId: goalId,
      statusProperty: page.properties.Status,
      allProperties: Object.keys(page.properties)
    });
  } catch (error) {
    console.error('Error reading goal:', error);
    res.status(500).json({ error: error.message });
  }
}