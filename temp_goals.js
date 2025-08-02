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
        sorts: [{
          property: "Status",
          direction: "ascending"
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API Error ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    
    // User ID to name mapping based on goal ownership
    const userIdToName = {
      '0e594686-ffd9-424b-9daa-0306638a2221': 'Jimmy Buffi',        // Build NBA Biomechanics Ecosystem, Dashboard 2.0
      '46ee46c2-f482-48a5-8078-95cfc93815a1': 'Evan Demchick',     // Be MLB's best league partner
      '6c9ff824-2dd2-4e19-b5b8-6051d56966fe': 'Robert Calise',     // Infrastructure 2.0 (Vanta)
      '33227521-8428-4238-94e0-53401caa529b': 'Creagor Elsom',     // Infrastructure 2.0 (other)
      '9b1d8a2c-2dfe-4fe7-a9a4-9fb330396bd3': 'Jacob Howenstein'   // Be MLB's best team partner
    };

    // Helper function to extract owner name from Notion people property
    const extractOwnerName = (ownerProp) => {
      if (!ownerProp || !ownerProp.people || ownerProp.people.length === 0) {
        return 'Unassigned';
      }
      
      const person = ownerProp.people[0];
      
      // Try to get name from various possible locations in the person object
      if (person.name) {
        return person.name;
      }
      
      if (person.person && person.person.email) {
        // Extract name from email (username part)
        return person.person.email.split('@')[0];
      }
      
      // Use the ID mapping as fallback
      if (person.id && userIdToName[person.id]) {
        return userIdToName[person.id];
      }
      
      // If we still don't have a name, return ID for identification
      return `User ${person.id.substring(0, 8)}`;
    };
    
    // Helper function to extract full rich text content
    const extractRichText = (richTextArray) => {
      if (!richTextArray || richTextArray.length === 0) return '';
      return richTextArray.map(item => item.plain_text || '').join('');
    };

    // Helper function to extract rich text with HTML links preserved
    const extractRichTextWithLinks = (richTextArray) => {
      if (!richTextArray || richTextArray.length === 0) return '';
      return richTextArray.map(item => {
        const text = item.plain_text || '';
        // If the text segment has a link, wrap it in an HTML anchor tag
        if (item.text && item.text.link && item.text.link.url) {
          return `<a href="${item.text.link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${text}</a>`;
        }
        return text;
      }).join('');
    };
    
    // Transform Notion data to our format
    const transformedGoals = data.results.map((page) => {
      return {
        id: page.id,
        title: extractRichText(page.properties.Project?.title) || 'Untitled',
        titleWithLinks: extractRichTextWithLinks(page.properties.Project?.title) || 'Untitled',
        quarter: page.properties.Quarter?.select?.name || 'Q3',
        status: page.properties.Status?.status?.name || page.properties.Status?.select?.name || 'Not started',
        owner: extractOwnerName(page.properties.Owner),
        completion: Math.round((page.properties.Progress?.number || 0) * 100),
        focus: page.properties.Focus?.multi_select?.map(option => option.name).join(', ') || 'General',
        keyResults: extractRichTextWithLinks(page.properties['Open KRs']?.rich_text),
        completedKRs: extractRichTextWithLinks(page.properties['Completed KRs']?.rich_text),
        lastUpdated: page.last_edited_time?.split('T')[0] || new Date().toISOString().split('T')[0],
        // Latest update fields
        latestUpdateDate: page.properties['Latest Update Date']?.date?.start || null,
        latestUpdateWentWell: extractRichText(page.properties['Latest Update - What Went Well']?.rich_text) || '',
        latestUpdateChallenges: extractRichText(page.properties['Latest Update - Challenges']?.rich_text) || '',
        latestUpdateCompletedKRs: extractRichText(page.properties['Latest Update - Completed KRs']?.rich_text) || ''
      };
    });

    // Custom sorting: Status (In progress first), then Focus (alphabetically)
    const statusPriority = {
      'In progress': 1,
      'Not started': 2,
      'At Risk': 3,
      'Carried Forward': 4,
      'Achieved': 5,
      'Completed': 5
    };

    transformedGoals.sort((a, b) => {
      // First sort by status priority
      const statusA = statusPriority[a.status] || 999;
      const statusB = statusPriority[b.status] || 999;
      
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      // Then sort by focus alphabetically (automatic, no hard-coding)
      return a.focus.localeCompare(b.focus);
    });

    // Calculate quarter progress
    const getQuarterInfo = () => {
      const now = new Date();
      
      let quarter, startDate, endDate;
      
      // Custom quarter system: Jan 11 - Apr 10 (Q1), Apr 11 - Jul 10 (Q2), Jul 11 - Oct 10 (Q3), Oct 11 - Jan 10 (Q4)
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // January is 1
      const day = now.getDate();
      
      if ((month === 1 && day >= 11) || month === 2 || month === 3 || (month === 4 && day <= 10)) {
        quarter = 'Q1';
        startDate = new Date(year, 0, 11); // Jan 11
        endDate = new Date(year, 3, 10); // Apr 10
      } else if ((month === 4 && day >= 11) || month === 5 || month === 6 || (month === 7 && day <= 10)) {  
        quarter = 'Q2';
        startDate = new Date(year, 3, 11); // Apr 11
        endDate = new Date(year, 6, 10); // Jul 10
      } else if ((month === 7 && day >= 11) || month === 8 || month === 9 || (month === 10 && day <= 10)) {
        quarter = 'Q3';
        startDate = new Date(year, 6, 11); // Jul 11
        endDate = new Date(year, 9, 10); // Oct 10
      } else {
        quarter = 'Q4';
        if (month <= 1) { // January 1-10 belongs to Q4 of previous year
          startDate = new Date(year - 1, 9, 11); // Oct 11 of previous year
          endDate = new Date(year, 0, 10); // Jan 10 of current year
        } else { // October 11 onwards
          startDate = new Date(year, 9, 11); // Oct 11
          endDate = new Date(year + 1, 0, 10); // Jan 10 of next year
        }
      }
      
      // Calculate progress through the quarter (0-1)
      const totalQuarterDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const quarterProgress = Math.max(0, Math.min(1, daysSinceStart / totalQuarterDays));
      
      return { quarter, quarterProgress: quarterProgress * 100 };
    };

    const { quarter: currentQuarter, quarterProgress } = getQuarterInfo();

    res.status(200).json({ 
      goals: transformedGoals,
      quarterProgress: quarterProgress,
      quarter: currentQuarter
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: error.message });
  }
}
