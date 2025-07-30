import { WebClient } from '@slack/web-api';

export default async function handler(req, res) {
  console.log('=== Slack Send Check-ins API Called ===');
  console.log('Method:', req.method);
  console.log('Has SLACK_BOT_TOKEN:', !!process.env.SLACK_BOT_TOKEN);
  console.log('Request body keys:', Object.keys(req.body || {}));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  
  if (!slackToken) {
    console.error('SLACK_BOT_TOKEN not found in environment variables');
    return res.status(500).json({ error: 'Slack bot token not configured' });
  }

  // Fetch goals data if not provided in request body
  let { goals, quarterProgress } = req.body;
  
  if (!goals || !Array.isArray(goals) || !quarterProgress) {
    console.log('Goals data not provided in request body, fetching from API...');
    
    try {
      // Make internal request to get goals data
      const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
      const goalsResponse = await fetch(`${baseUrl}/api/goals`);
      
      if (!goalsResponse.ok) {
        throw new Error(`Failed to fetch goals: ${goalsResponse.status}`);
      }
      
      const goalsData = await goalsResponse.json();
      goals = goalsData.goals;
      quarterProgress = goalsData.quarterProgress;
      
      console.log('Fetched goals data:', { goalCount: goals.length, quarterProgress });
    } catch (error) {
      console.error('Error fetching goals data:', error);
      return res.status(500).json({ error: 'Failed to fetch goals data' });
    }
  }

  if (!goals || !Array.isArray(goals)) {
    console.error('Invalid goals data after fetch:', { goals, quarterProgress });
    return res.status(400).json({ error: 'Goals array is required' });
  }

  console.log('Processing goals for', goals.length, 'items');

  const slack = new WebClient(slackToken);

  try {
    // Get unique owners and their goals
    const ownerGoals = {};
    goals.forEach(goal => {
      const owner = goal.owner;
      if (!ownerGoals[owner]) {
        ownerGoals[owner] = [];
      }
      ownerGoals[owner].push(goal);
    });

    const sentCount = await Promise.all(
      Object.entries(ownerGoals).map(async ([owner, userGoals]) => {
        try {
          // For now, we'll use a test user ID - you'll need to map owner names to Slack user IDs
          // This is a placeholder - you'll need to implement user lookup
          const userId = await lookupSlackUserId(owner, slack);
          
          if (!userId) {
            console.warn(`No Slack user ID found for ${owner}`);
            return 0;
          }

          // Send a DM to the user with all their goals
          await sendGoalCheckinsToUser(slack, userId, userGoals, quarterProgress);
          return 1;
        } catch (error) {
          console.error(`Failed to send check-in to ${owner}:`, error);
          return 0;
        }
      })
    );

    const totalSent = sentCount.reduce((sum, count) => sum + count, 0);

    res.status(200).json({ 
      success: true, 
      sentCount: totalSent,
      totalOwners: Object.keys(ownerGoals).length
    });

  } catch (error) {
    console.error('=== Slack API Error ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error data:', error.data);
    res.status(500).json({ 
      error: error.message,
      details: error.data || 'No additional error details'
    });
  }
}

// Helper function to lookup Slack user ID by name
async function lookupSlackUserId(ownerName, slack) {
  try {
    // Get all users and log them for debugging
    const result = await slack.users.list();
    console.log('Available Slack users:');
    result.members.forEach(member => {
      if (!member.is_bot && !member.deleted) {
        console.log(`- ${member.real_name || member.name} (${member.id}) - Display: ${member.profile?.display_name || 'none'}`);
      }
    });
    
    // Look for user by various name matches
    const user = result.members.find(member => 
      member.real_name === ownerName || 
      member.display_name === ownerName ||
      member.profile?.display_name === ownerName ||
      member.name === ownerName.toLowerCase().replace(/\s+/g, '') ||
      member.profile?.real_name === ownerName
    );
    
    if (user) {
      console.log(`Found user: ${ownerName} -> ${user.id} (${user.real_name})`);
      return user.id;
    } else {
      console.log(`No user found for: ${ownerName}`);
      return null;
    }
  } catch (error) {
    console.error('Error looking up user:', error);
    return null;
  }
}

// Helper function to send check-in messages to a user
async function sendGoalCheckinsToUser(slack, userId, userGoals, quarterProgress) {
  for (const goal of userGoals) {
    const expectedProgress = Math.round(quarterProgress);
    const currentProgress = goal.completion;
    
    // Create the interactive message with thread support
    const message = {
      channel: userId, // DM channel
      text: `Weekly check-in for ${goal.quarter} goals`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Hey! 👋 Weekly check-in for ${goal.quarter} goals`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🎯 *${goal.title}* (${currentProgress}% complete)\n\nWe're ${expectedProgress}% through ${goal.quarter} - time for your weekly update:`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "📝 Update Progress",
                emoji: true
              },
              style: "primary",
              action_id: "start_checkin",
              value: JSON.stringify({
                goalId: goal.id,
                goalTitle: goal.title,
                currentProgress: currentProgress,
                expectedProgress: expectedProgress,
                quarter: goal.quarter
              })
            }
          ]
        }
      ]
    };

    await slack.chat.postMessage(message);
  }
}