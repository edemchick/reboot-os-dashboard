export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { partner, testUser, triggeredBy } = req.body;

  if (!partner) {
    return res.status(400).json({ error: 'Partner data is required' });
  }

  if (!testUser) {
    return res.status(400).json({ error: 'Test user is required' });
  }

  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  if (!slackBotToken) {
    return res.status(500).json({ error: 'Slack bot token not configured' });
  }

  try {
    // Skip partners with no main contact for test purposes (same logic as original)
    if (!partner.mainContact || partner.mainContact === 'Unassigned' || partner.mainContact.trim() === '') {
      console.log(`Skipping test for partner ${partner.partnerName} - no main contact assigned`);
      return res.status(200).json({ 
        skipped: true,
        message: `Skipped ${partner.partnerName} - no main contact assigned` 
      });
    }

    // Resolve test user ID
    const { WebClient } = require('@slack/web-api');
    const slack = new WebClient(slackBotToken);
    console.log('🔍 About to resolve test user:', testUser);
    const testUserId = await resolveTestUserId(testUser, slack);
    
    if (!testUserId) {
      console.error(`No Slack user found for test user: ${testUser}`);
      return res.status(400).json({ 
        error: `No Slack user found for test user: ${testUser}` 
      });
    }

    console.log(`Sending test partner check-in for ${partner.partnerName} to test user ${testUser} (${testUserId})`);

    // Create the test check-in message with interactive button
    const message = {
      channel: testUserId,
      text: `🧪 TEST: Partner Update: ${partner.partnerName} (would go to ${partner.mainContact})`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🧪 **TEST MODE** - Partner check-in\n_This would normally be sent to: ${partner.mainContact}_`
          }
        },
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🤝 Partner Update: ${partner.partnerName}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Current Health Score:* ${partner.currentHealthScore}/10 ${partner.trend}`
            },
            {
              type: 'mrkdwn',
              text: `*Last Updated:* ${partner.lastUpdated ? new Date(partner.lastUpdated).toLocaleDateString() : 'Never'}`
            },
            {
              type: 'mrkdwn',
              text: `*Category:* ${partner.category}`
            },
            {
              type: 'mrkdwn',
              text: `*Main Contact:* ${partner.mainContact}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Please provide this week\'s update for this partner:'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: `Update ${partner.partnerName} (TEST)`,
                emoji: true
              },
              style: 'primary',
              action_id: 'partner_update_button',
              value: JSON.stringify({
                partnerId: partner.id,
                partnerName: partner.partnerName,
                currentHealthScore: partner.currentHealthScore,
                previousHealthScore: partner.currentHealthScore,
                isTest: true,
                originalContact: partner.mainContact
              })
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🧪 TEST MODE | Triggered by: ${triggeredBy} | Original contact: ${partner.mainContact} | Partner dashboard: <${process.env.NEXTAUTH_URL || 'http://localhost:3000'}|View Dashboard>`
            }
          ]
        }
      ]
    };

    // Send the test Slack message
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackBotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const slackData = await slackResponse.json();

    if (!slackData.ok) {
      console.error('Slack API error:', slackData);
      return res.status(500).json({ 
        error: 'Failed to send test Slack message', 
        details: slackData.error 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: `Test partner check-in sent to ${testUser} for ${partner.partnerName} (would normally go to ${partner.mainContact})`,
      slackChannel: testUserId,
      slackTimestamp: slackData.ts,
      originalContact: partner.mainContact
    });

  } catch (error) {
    console.error('Error sending test partner check-in:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to resolve test user ID using the same proven approach as regular check-ins
async function resolveTestUserId(testUserInput, slack) {
  try {
    console.log('🔍 resolveTestUserId called with input:', testUserInput);
    
    // If it looks like a Slack user ID (starts with U), return it directly
    if (testUserInput.match(/^U[A-Z0-9]+$/)) {
      console.log(`✅ Test user ${testUserInput} appears to be a Slack user ID - returning directly`);
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