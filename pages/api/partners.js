export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const notionToken = process.env.NOTION_TOKEN;
  const partnersDbId = process.env.NOTION_PARTNERS_DATABASE_ID;

  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  if (!partnersDbId) {
    return res.status(500).json({ error: 'Partners database ID not configured' });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${partnersDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: {
          property: "Status",
          select: {
            equals: "Active"
          }
        },
        sorts: [
          {
            property: "Category",
            direction: "ascending"
          },
          {
            property: "Partner Name", 
            direction: "ascending"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Notion API error:', response.status, errorData);
      return res.status(response.status).json({ 
        error: 'Failed to fetch partners from Notion',
        details: errorData 
      });
    }

    const data = await response.json();
    
    // Transform the data to extract the properties we need
    const partners = data.results.map(page => {
      const properties = page.properties;
      
      // Extract health score from rollup array
      const healthScoreRollup = properties['Current Health Score']?.rollup;
      let currentHealthScore = 0;
      if (healthScoreRollup?.type === 'array' && healthScoreRollup.array?.length > 0) {
        currentHealthScore = healthScoreRollup.array[0]?.number || 0;
      } else if (healthScoreRollup?.number) {
        currentHealthScore = healthScoreRollup.number;
      }

      // Extract trend from rollup array 
      const trendRollup = properties['Trend']?.rollup;
      let trend = '→';
      if (trendRollup?.type === 'array' && trendRollup.array?.length > 0) {
        const trendItem = trendRollup.array[0];
        if (trendItem?.type === 'formula' && trendItem.formula?.string) {
          trend = trendItem.formula.string;
        } else if (trendItem?.rich_text?.[0]?.text?.content) {
          trend = trendItem.rich_text[0].text.content;
        }
      }
      
      // Extract last updated from rollup array
      const lastUpdatedRollup = properties['Last Updated']?.rollup;
      let lastUpdated = null;
      if (lastUpdatedRollup?.type === 'array' && lastUpdatedRollup.array?.length > 0) {
        const dateItem = lastUpdatedRollup.array[0];
        if (dateItem?.type === 'date' && dateItem.date?.start) {
          lastUpdated = dateItem.date.start;
        }
      }
      
      // Extract key updates from rollup array
      const keyUpdatesRollup = properties['Key Updates']?.rollup;
      let keyUpdates = '';
      if (keyUpdatesRollup?.type === 'array' && keyUpdatesRollup.array?.length > 0) {
        const updatesItem = keyUpdatesRollup.array[0];
        if (updatesItem?.type === 'rich_text' && updatesItem.rich_text?.length > 0) {
          keyUpdates = updatesItem.rich_text.map(rt => rt.text?.content || '').join('');
        }
      }
      
      // Extract action items from rollup array
      const actionItemsRollup = properties['Action Items']?.rollup;
      let actionItems = '';
      if (actionItemsRollup?.type === 'array' && actionItemsRollup.array?.length > 0) {
        const actionsItem = actionItemsRollup.array[0];
        if (actionsItem?.type === 'rich_text' && actionsItem.rich_text?.length > 0) {
          actionItems = actionsItem.rich_text.map(rt => rt.text?.content || '').join('');
        }
      }
      
      return {
        id: page.id,
        partnerName: properties['Partner Name']?.title?.[0]?.text?.content || 'Untitled',
        category: properties['Category']?.select?.name || 'Uncategorized',
        mainContact: properties['Main Contact']?.people?.[0]?.name || 'Unassigned',
        currentHealthScore: currentHealthScore,
        trend: trend,
        lastUpdated: lastUpdated,
        keyUpdates: keyUpdates,
        actionItems: actionItems
      };
    });

    res.status(200).json(partners);
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}