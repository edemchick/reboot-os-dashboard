export default async function handler(req, res) {
  const goalId = "238ee4a677df8048adb9cf54beaba558";
  const notionToken = process.env.NOTION_TOKEN;

  try {
    console.log('Testing update for goal:', goalId);
    
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
              name: "Achieved"
            }
          }
        }
      })
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.log('Error data:', errorData);
      return res.status(response.status).json({ 
        error: errorData,
        requestBody: {
          properties: {
            Status: {
              status: {
                name: "Achieved"
              }
            }
          }
        }
      });
    }

    const updatedPage = await response.json();
    
    res.status(200).json({ 
      success: true,
      newStatus: updatedPage.properties.Status
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}