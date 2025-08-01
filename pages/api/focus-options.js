export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID || '238ee4a677df80c18e68d094de3fd6d6';

  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  try {
    // Get database schema to extract Focus multi-select options
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API Error ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    
    // Extract Focus field options
    const focusProperty = data.properties.Focus;
    if (!focusProperty || focusProperty.type !== 'multi_select') {
      return res.status(500).json({ error: 'Focus property not found or not a multi-select' });
    }

    const focusOptions = focusProperty.multi_select.options.map(option => ({
      name: option.name,
      color: option.color
    }));

    res.status(200).json({ 
      focusOptions,
      count: focusOptions.length
    });

  } catch (error) {
    console.error('Error fetching focus options:', error);
    
    // Fallback to a basic set if API fails
    const fallbackOptions = [
      { name: 'MLB Teams', color: 'blue' },
      { name: 'NBA Teams', color: 'purple' },
      { name: 'Product', color: 'green' },
      { name: 'Infrastructure', color: 'orange' }
    ];
    
    res.status(200).json({ 
      focusOptions: fallbackOptions,
      count: fallbackOptions.length,
      fallback: true,
      error: error.message
    });
  }
}