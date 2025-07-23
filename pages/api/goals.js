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
      body: JSON.stringify({
        // Remove sorting to maintain Notion's order
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API Error ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    
    // Helper function to extract full rich text content
    const extractRichText = (richTextArray) => {
      if (!richTextArray || richTextArray.length === 0) return '';
      return richTextArray.map(item => item.plain_text || '').join('');
    };
    
    // Transform Notion data to our format
    const transformedGoals = data.results.map(page => ({
      id: page.id,
      title: page.properties.Project?.title?.[0]?.plain_text || 'Untitled',
      quarter: page.properties.Quarter?.select?.name || 'Q3',
      status: page.properties.Status?.status?.name || page.properties.Status?.select?.name || 'Not started',
      owner: page.properties.Owner?.people?.[0]?.name || 'Unassigned',
      completion: parseInt(page.properties.Progress?.number || 0),
      focus: page.properties.Focus?.multi_select?.map(option => option.name).join(', ') || 'General',
      keyResults: extractRichText(page.properties['Key Results']?.rich_text),
      completedKRs: extractRichText(page.properties['Completed KRs']?.rich_text),
      lastUpdated: page.last_edited_time?.split('T')[0] || new Date().toISOString().split('T')[0]
    }));

    res.status(200).json({ goals: transformedGoals });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: error.message });
  }
}
