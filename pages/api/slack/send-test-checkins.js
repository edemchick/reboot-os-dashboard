import { WebClient } from '@slack/web-api';
import { getAdminConfig } from '../admin/admin-config.js';

export default async function handler(req, res) {
  console.log('=== Slack Send Test Check-ins API Called ===');
  console.log('Method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  
  if (!slackToken) {
    console.error('SLACK_BOT_TOKEN not found in environment variables');
    return res.status(500).json({ error: 'Slack bot token not configured' });
  }

  // Get admin config to find test user
  const adminConfig = getAdminConfig();
  console.log('🔍 Admin config loaded:', JSON.stringify(adminConfig, null, 2));
  
  if (!adminConfig.testUser) {
    return res.status(400).json({ error: 'No test user configured. Please set a test user in Admin Configuration.' });
  }

  console.log('✅ Test user configured:', adminConfig.testUser);

  // Fetch goals data
  let { goals, quarterProgress } = req.body;
  
  if (!goals || !Array.isArray(goals) || !quarterProgress) {
    console.log('Goals data not provided in request body, fetching from API...');
    
    try {
      const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
      const goalsResponse = await fetch(`${baseUrl}/api/goals`);
      
      if (!goalsResponse.ok) {
        throw new Error(`Failed to fetch goals: ${goalsResponse.status}`);
      }
      
      const goalsData = await goalsResponse.json();
      const allGoals = goalsData.goals;
      const currentQuarter = goalsData.quarter;
      quarterProgress = goalsData.quarterProgress;
      
      // Filter goals to only current quarter
      goals = allGoals.filter(goal => 
        goal.quarter === currentQuarter && 
        goal.quarter !== 'Non Priorities' && 
        goal.quarter !== 'Not Prioritized' && 
        goal.quarter !== 'Backlog'
      );
      
      console.log('Fetched goals data for testing:', { 
        totalGoals: allGoals.length, 
        currentQuarterGoals: goals.length, 
        currentQuarter,
        quarterProgress 
      });
    } catch (error) {
      console.error('Error fetching goals data:', error);
      return res.status(500).json({ error: 'Failed to fetch goals data' });
    }
  }

  if (!goals || !Array.isArray(goals)) {
    console.error('Invalid goals data after fetch:', { goals, quarterProgress });
    return res.status(400).json({ error: 'Goals array is required' });
  }

  console.log('Processing test check-ins for', goals.length, 'goals');

  const slack = new WebClient(slackToken);

  try {
    // Resolve test user ID
    const testUserId = await resolveTestUserId(adminConfig.testUser, slack);
    
    if (!testUserId) {
      return res.status(400).json({ 
        error: `Could not find test user: ${adminConfig.testUser}. Please check the test user configuration.` 
      });
    }

    console.log(`Resolved test user ${adminConfig.testUser} to ID: ${testUserId}`);

    // Group goals by owner for better organization in test messages
    const ownerGoals = {};
    goals.forEach(goal => {
      const owner = goal.owner;
      if (!ownerGoals[owner]) {
        ownerGoals[owner] = [];
      }
      ownerGoals[owner].push(goal);
    });

    // Send all check-ins to the test user
    let totalSentGoals = 0;
    for (const [owner, userGoals] of Object.entries(ownerGoals)) {
      // Send a header message to indicate which owner's goals these are
      await slack.chat.postMessage({
        channel: testUserId,
        text: `🧪 **TEST CHECK-IN** - Goals for: ${owner}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🧪 **TEST CHECK-IN** - Goals for: *${owner}*\n_These check-ins would normally be sent to ${owner}_`
            }
          },
          {
            type: "divider"
          }
        ]
      });

      // Send each goal check-in
      for (const goal of userGoals) {
        await sendTestGoalCheckinToUser(slack, testUserId, goal, quarterProgress, owner);
        totalSentGoals++;
      }
    }

    res.status(200).json({ 
      success: true, 
      sentCount: totalSentGoals,
      totalOwners: Object.keys(ownerGoals).length,
      testUser: adminConfig.testUser
    });

  } catch (error) {
    console.error('=== Test Slack API Error ===');
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

// Helper function to resolve test user ID using the same proven approach as regular check-ins
async function resolveTestUserId(testUserInput, slack) {
  try {
    // If it looks like a Slack user ID (starts with U), return it directly
    if (testUserInput.match(/^U[A-Z0-9]+$/)) {
      console.log(`Test user ${testUserInput} appears to be a Slack user ID`);
      return testUserInput;
    }

    // Get all users and search through them (same as working goals check-in)
    console.log(`Searching for test user: ${testUserInput}`);
    const result = await slack.users.list();
    
    // Log available users for debugging
    console.log('Available Slack users:');
    result.members.forEach(member => {
      if (!member.is_bot && !member.deleted) {
        console.log(`- ${member.real_name || member.name} (${member.id}) - Email: ${member.profile?.email || 'none'} - Display: ${member.profile?.display_name || 'none'}`);
      }
    });
    
    // Remove @ prefix if present
    const searchInput = testUserInput.startsWith('@') ? testUserInput.slice(1) : testUserInput;
    
    // Helper function to check if input matches a Slack member
    const nameMatches = (inputToCheck, member) => {
      const realName = member.real_name || '';
      const displayName = member.profile?.display_name || '';
      const username = member.name || '';
      const profileRealName = member.profile?.real_name || '';
      const email = member.profile?.email || '';
      
      // Exact matches
      if (realName === inputToCheck || displayName === inputToCheck || profileRealName === inputToCheck || email === inputToCheck) {
        return true;
      }
      
      // Username match (lowercase, no spaces)
      if (username === inputToCheck.toLowerCase().replace(/\s+/g, '')) {
        return true;
      }
      
      // Partial name matching for common variations
      const inputParts = inputToCheck.toLowerCase().split(' ');
      const realNameParts = realName.toLowerCase().split(' ');
      
      // Check if all parts of input exist in Slack real name
      if (inputParts.length >= 2 && realNameParts.length >= 2) {
        const firstNameMatch = inputParts[0] === realNameParts[0];
        const lastNameMatch = inputParts[inputParts.length - 1] === realNameParts[realNameParts.length - 1];
        
        if (firstNameMatch && lastNameMatch) {
          return true;
        }
      }
      
      // Email contains check for partial emails
      if (inputToCheck.includes('@') && email.toLowerCase().includes(inputToCheck.toLowerCase())) {
        return true;
      }
      
      return false;
    };
    
    const user = result.members.find(member => {
      if (member.is_bot || member.deleted) return false;
      return nameMatches(searchInput, member);
    });

    if (user) {
      console.log(`✅ Found test user: ${testUserInput} -> ${user.id} (${user.real_name})`);
      return user.id;
    }

    console.error(`❌ Test user not found: ${testUserInput}`);
    console.log('🔍 Tried matching against these users:');
    result.members.forEach(member => {
      if (!member.is_bot && !member.deleted) {
        console.log(`  - Real: "${member.real_name}" | Email: "${member.profile?.email || 'none'}" | Display: "${member.profile?.display_name || 'none'}" | Username: "${member.name}"`);
      }
    });
    return null;
  } catch (error) {
    console.error('Error resolving test user ID:', error);
    return null;
  }
}

// Helper function to send test check-in message
async function sendTestGoalCheckinToUser(slack, userId, goal, quarterProgress, originalOwner) {
  const expectedProgress = Math.round(quarterProgress);
  const currentProgress = goal.completion;
  
  const message = {
    channel: userId,
    text: `🧪 TEST: Weekly check-in for ${goal.quarter} goals (${originalOwner})`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🧪 **TEST MODE** - Hey! 👋 Weekly check-in for ${goal.quarter} goals\n_This would be sent to: ${originalOwner}_`
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
              text: "📝 Update Progress (TEST)",
              emoji: true
            },
            style: "primary",
            action_id: "start_checkin",
            value: JSON.stringify({
              goalId: goal.id,
              goalTitle: goal.title,
              currentProgress: currentProgress,
              expectedProgress: expectedProgress,
              quarter: goal.quarter,
              keyResults: goal.keyResults || '',
              completedKRs: goal.completedKRs || '',
              isTest: true,
              originalOwner: originalOwner
            })
          }
        ]
      }
    ]
  };

  await slack.chat.postMessage(message);
}