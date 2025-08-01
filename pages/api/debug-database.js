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
    // Get database schema
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
    
    // Extract property types for debugging
    const properties = {};
    Object.keys(data.properties).forEach(key => {
      const prop = data.properties[key];
      properties[key] = {
        type: prop.type,
        ...(prop.type === 'select' && { options: prop.select.options.map(opt => opt.name) }),
        ...(prop.type === 'status' && { options: prop.status.options.map(opt => opt.name) }),
        ...(prop.type === 'multi_select' && { options: prop.multi_select.options.map(opt => opt.name) })
      };
    });

    res.status(200).json({ properties });

  } catch (error) {
    console.error('Error fetching database schema:', error);
    res.status(500).json({ error: error.message });
  }
}