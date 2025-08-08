export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const notionToken = process.env.NOTION_TOKEN;
  // You'll need to add NOTION_LONGTERM_DATABASE_ID to your environment variables
  const databaseId = process.env.NOTION_LONGTERM_DATABASE_ID;

  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  if (!databaseId) {
    return res.status(500).json({ error: 'Long term database ID not configured. Please add NOTION_LONGTERM_DATABASE_ID to your environment variables.' });
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
        sorts: [{
          property: "Type",
          direction: "ascending"
        }]
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
    const transformedGoals = data.results.map((page) => {
      // Debug: log the Progress property to see what we're getting
      console.log('Progress property:', JSON.stringify(page.properties.Progress, null, 2));
      
      return {
        id: page.id,
        name: extractRichText(page.properties.Name?.title) || 'Untitled',
        goal: extractRichText(page.properties.Goal?.rich_text) || 'No goal description',
        progress: extractRichText(page.properties.Progress?.rich_text) || 
                 extractRichText(page.properties.Progress?.title) ||
                 (page.properties.Progress?.number ? parseInt(page.properties.Progress.number) : ''),
        progressNumber: parseInt(page.properties.Progress?.number || 0),
        progressDate: page.properties.Date?.date?.start || null,
        type: page.properties.Type?.select?.name || 'Uncategorized',
        owner: extractRichText(page.properties.Owner?.rich_text) || 'Unassigned',
        lastUpdated: page.last_edited_time?.split('T')[0] || new Date().toISOString().split('T')[0]
      };
    });

    // Filter out any items that don't have the expected types (flexible matching)
    const filteredGoals = transformedGoals.filter(goal => 
      goal.type.includes('5 Year Vision') || 
      goal.type.includes('3 Year Picture') || 
      goal.type.includes('Annual Plan')
    );

    // Sort by type order: 5 Year Vision, 3 Year Picture, Annual Plan (flexible matching)
    const getTypeOrder = (type) => {
      if (type.includes('5 Year Vision')) return 1;
      if (type.includes('3 Year Picture')) return 2;
      if (type.includes('Annual Plan')) return 3;
      return 999;
    };

    filteredGoals.sort((a, b) => {
      const orderA = getTypeOrder(a.type);
      const orderB = getTypeOrder(b.type);
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If same type, sort by name alphabetically
      return a.name.localeCompare(b.name);
    });

    res.status(200).json({ goals: filteredGoals });
  } catch (error) {
    console.error('Error fetching long term goals:', error);
    res.status(500).json({ error: error.message });
  }
}