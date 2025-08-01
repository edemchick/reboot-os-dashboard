import { WebClient } from '@slack/web-api';

// Helper function to calculate KR deadline (1 week before quarter start)
function getKRDeadline(quarter) {
  const quarterStartDates = {
    'Q1': new Date('2026-01-11'),  // Next year Q1
    'Q2': new Date('2025-04-11'),
    'Q3': new Date('2025-07-11'),
    'Q4': new Date('2025-10-11')
  };
  
  const startDate = quarterStartDates[quarter];
  if (!startDate) return 'TBD';
  
  const deadline = new Date(startDate);
  deadline.setDate(deadline.getDate() - 7); // 1 week before
  
  return deadline.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper function to look up Slack user ID by name
async function lookupSlackUserId(ownerName, slack) {
  try {
    const result = await slack.users.list();
    
    const user = result.members.find(member => 
      member.real_name === ownerName || 
      member.display_name === ownerName ||
      member.profile?.display_name === ownerName ||
      member.name === ownerName.toLowerCase().replace(/\s+/g, '') ||
      member.profile?.real_name === ownerName
    );
    
    return user?.id || null;
  } catch (error) {
    console.error('Error looking up user:', error);
    return null;
  }
}

// Helper function to send Slack notification
async function sendCarryForwardNotification(owner, title, quarter, focus) {
  const slackToken = process.env.SLACK_BOT_TOKEN;
  
  if (!slackToken) {
    console.log('Slack bot token not configured, skipping notification');
    return;
  }

  try {
    const slack = new WebClient(slackToken);
    const slackUserId = await lookupSlackUserId(owner, slack);
    
    if (!slackUserId) {
      console.warn(`No Slack user ID found for ${owner}`);
      return;
    }

    const krDeadline = getKRDeadline(quarter);
    
    const message = {
      channel: slackUserId,
      text: `🎯 New Company Goal Assignment for ${quarter}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🎯 New Company Goal for ${quarter}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `You've been assigned a company goal for ${quarter}:\n\n*"${title}"*\n\n📋 *Focus Area:* ${focus}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🎯 *${title}* (${quarter})\n\n📅 *Action Required:* Please prepare your Key Results (KRs) for this goal.\n\n⏰ *Deadline:* ${krDeadline}\n\nYour KRs should be specific, measurable outcomes that will help achieve this goal. Please submit them for approval before the deadline.`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Submit Goal for Approval",
                emoji: true
              },
              style: "primary",
              action_id: "submit_goal_approval",
              value: JSON.stringify({
                goalId: "temp-id",
                goalTitle: title,
                currentProgress: 0,
                expectedProgress: 25,
                quarter: quarter
              })
            }
          ]
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 Need help defining KRs? Reach out to your manager or check the goal-setting guidelines."
            }
          ]
        }
      ]
    };

    const result = await slack.chat.postMessage(message);
    console.log(`✅ Slack notification sent to ${owner} (${slackUserId}) for goal: ${title}`);
    console.log('📤 Message result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, focus, owner, quarter } = req.body;

  if (!title || !focus || !owner || !quarter) {
    return res.status(400).json({ error: 'Missing required fields: title, focus, owner, quarter' });
  }

  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID || '238ee4a677df80c18e68d094de3fd6d6';

  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  // Load dynamic employee to user ID mapping from employee config
  let employeeToUserId = {};
  try {
    const fs = require('fs');
    const path = require('path');
    const employeeConfigPath = path.join(process.cwd(), 'config', 'employee-config.json');
    
    if (fs.existsSync(employeeConfigPath)) {
      const employeeConfig = JSON.parse(fs.readFileSync(employeeConfigPath, 'utf8'));
      employeeToUserId = employeeConfig.employees.reduce((acc, employee) => {
        acc[employee.name] = employee.notionUserId;
        return acc;
      }, {});
    }
  } catch (error) {
    console.error('Error loading employee config, using fallback:', error);
  }
  
  // Fallback mapping if config file doesn't exist or fails to load
  if (Object.keys(employeeToUserId).length === 0) {
    employeeToUserId = {
      'Jimmy Buffi': '0e594686-ffd9-424b-9daa-0306638a2221',
      'Evan Demchick': '46ee46c2-f482-48a5-8078-95cfc93815a1',
      'Robert Calise': '6c9ff824-2dd2-4e19-b5b8-6051d56966fe',
      'Creagor Elsom': '33227521-8428-4238-94e0-53401caa529b',
      'Jacob Howenstein': '9b1d8a2c-2dfe-4fe7-a9a4-9fb330396bd3'
    };
  }

  const userId = employeeToUserId[owner];
  if (!userId) {
    return res.status(400).json({ error: `Invalid owner: ${owner}` });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: {
          database_id: databaseId
        },
        properties: {
          Project: {
            title: [
              {
                text: {
                  content: title
                }
              }
            ]
          },
          Quarter: {
            select: {
              name: quarter
            }
          },
          Status: {
            status: {
              name: "Not started"
            }
          },
          Owner: {
            people: [
              {
                id: userId
              }
            ]
          },
          Progress: {
            number: 0
          },
          Focus: {
            multi_select: [
              {
                name: focus
              }
            ]
          },
          'Open KRs': {
            rich_text: []
          },
          'Completed KRs': {
            rich_text: []
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Notion API Error:', errorData);
      throw new Error(`Notion API Error ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    
    // Send Slack notification to the goal owner
    await sendCarryForwardNotification(owner, title, quarter, focus);
    
    res.status(200).json({ 
      success: true, 
      message: 'Goal successfully carried forward',
      pageId: data.id 
    });

  } catch (error) {
    console.error('Error creating Notion page:', error);
    res.status(500).json({ 
      error: 'Failed to create goal in Notion',
      details: error.message 
    });
  }
}