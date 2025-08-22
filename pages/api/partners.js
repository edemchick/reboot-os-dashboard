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
      
      // Extract health score from formula or rollup
      const healthScoreProperty = properties['Current Health Score'];
      let currentHealthScore = 0;
      if (healthScoreProperty?.formula?.number !== undefined) {
        // Handle Formula -> Number
        currentHealthScore = healthScoreProperty.formula.number;
      } else if (healthScoreProperty?.rollup?.type === 'array' && healthScoreProperty.rollup.array?.length > 0) {
        // Handle Rollup -> Number (legacy support)
        currentHealthScore = healthScoreProperty.rollup.array[0]?.number || 0;
      } else if (healthScoreProperty?.rollup?.number) {
        currentHealthScore = healthScoreProperty.rollup.number;
      }

      // Extract trend from formula or rollup
      const trendProperty = properties['Trend'];
      let trend = '→';
      if (trendProperty?.formula?.string) {
        // Handle Formula -> String
        trend = trendProperty.formula.string;
      } else if (trendProperty?.rollup?.type === 'array' && trendProperty.rollup.array?.length > 0) {
        // Handle Rollup (legacy support)
        const trendItem = trendProperty.rollup.array[0];
        if (trendItem?.type === 'formula' && trendItem.formula?.string) {
          trend = trendItem.formula.string;
        } else if (trendItem?.rich_text?.[0]?.text?.content) {
          trend = trendItem.rich_text[0].text.content;
        }
      }
      
      // Extract last updated from rollup (single date or array)
      const lastUpdatedRollup = properties['Last Updated']?.rollup;
      let lastUpdated = null;
      if (lastUpdatedRollup?.date?.start) {
        // Handle single date rollup (e.g., "Latest" aggregation)
        lastUpdated = lastUpdatedRollup.date.start;
      } else if (lastUpdatedRollup?.type === 'array' && lastUpdatedRollup.array?.length > 0) {
        // Handle array rollup (legacy support)
        const dateItem = lastUpdatedRollup.array[0];
        if (dateItem?.type === 'date' && dateItem.date?.start) {
          lastUpdated = dateItem.date.start;
        }
      }
      
      // Extract key updates from formula or rollup
      const keyUpdatesProperty = properties['Key Updates'];
      let keyUpdates = '';
      if (keyUpdatesProperty?.formula?.string) {
        // Handle Formula -> String
        keyUpdates = keyUpdatesProperty.formula.string;
      } else if (keyUpdatesProperty?.rollup?.type === 'array' && keyUpdatesProperty.rollup.array?.length > 0) {
        // Handle Rollup (legacy support)
        const updatesItem = keyUpdatesProperty.rollup.array[0];
        if (updatesItem?.type === 'rich_text' && updatesItem.rich_text?.length > 0) {
          keyUpdates = updatesItem.rich_text.map(rt => rt.text?.content || '').join('');
        }
      }
      
      // Extract current hurdles from formula or rollup
      const currentHurdlesProperty = properties['Current Hurdles'];
      let currentHurdles = '';
      if (currentHurdlesProperty?.formula?.string) {
        // Handle Formula -> String
        currentHurdles = currentHurdlesProperty.formula.string;
      } else if (currentHurdlesProperty?.rollup?.type === 'array' && currentHurdlesProperty.rollup.array?.length > 0) {
        // Handle Rollup (legacy support)
        const hurdlesItem = currentHurdlesProperty.rollup.array[0];
        if (hurdlesItem?.type === 'rich_text' && hurdlesItem.rich_text?.length > 0) {
          currentHurdles = hurdlesItem.rich_text.map(rt => rt.text?.content || '').join('');
        }
      }
      
      // Extract action items from formula or rollup
      const actionItemsProperty = properties['Action Items'];
      let actionItems = '';
      if (actionItemsProperty?.formula?.string) {
        // Handle Formula -> String
        actionItems = actionItemsProperty.formula.string;
      } else if (actionItemsProperty?.rollup?.type === 'array' && actionItemsProperty.rollup.array?.length > 0) {
        // Handle Rollup (legacy support)
        const actionsItem = actionItemsProperty.rollup.array[0];
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
        currentHurdles: currentHurdles,
        actionItems: actionItems
      };
    });

    res.status(200).json(partners);
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}