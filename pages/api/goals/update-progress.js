export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const notionToken = process.env.NOTION_TOKEN;
  
  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  const { goalId, progress } = req.body;

  if (!goalId || progress === undefined) {
    return res.status(400).json({ error: 'Goal ID and progress are required' });
  }

  if (progress < 0 || progress > 100) {
    return res.status(400).json({ error: 'Progress must be between 0 and 100' });
  }

  try {
    // Update the goal's progress in Notion
    const response = await fetch(`https://api.notion.com/v1/pages/${goalId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        properties: {
          Progress: {
            number: progress
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
      goalId: goalId,
      newProgress: progress,
      updatedAt: updatedPage.last_edited_time
    });

  } catch (error) {
    console.error('Error updating goal progress:', error);
    res.status(500).json({ error: error.message });
  }
}