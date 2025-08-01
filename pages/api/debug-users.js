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
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
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
      throw new Error(`API Error ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    
    // Extract all unique user IDs from the goals
    const userIds = new Set();
    const userInfo = {};
    
    data.results.forEach(page => {
      const owner = page.properties.Owner;
      if (owner && owner.people && owner.people.length > 0) {
        owner.people.forEach(person => {
          userIds.add(person.id);
          userInfo[person.id] = {
            id: person.id,
            name: person.name || 'Unknown',
            email: (person.person && person.person.email) || 'Unknown'
          };
        });
      }
    });

    res.status(200).json({ 
      userIds: Array.from(userIds),
      userInfo,
      totalUsers: userIds.size
    });

  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: error.message });
  }
}