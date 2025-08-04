export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { partner, triggeredBy } = req.body;

  if (!partner) {
    return res.status(400).json({ error: 'Partner data is required' });
  }

  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  if (!slackBotToken) {
    return res.status(500).json({ error: 'Slack bot token not configured' });
  }

  try {
    // Map main contact to Slack user ID (you'll need to update these with actual Slack user IDs)
    const slackUserMapping = {
      'Evan Demchick': 'U123EXAMPLE', // Replace with actual Slack user ID
      // Add other main contacts and their Slack user IDs here
    };

    // Skip partners with no main contact or unassigned contacts
    if (!partner.mainContact || partner.mainContact === 'Unassigned' || partner.mainContact.trim() === '') {
      console.log(`Skipping partner ${partner.partnerName} - no main contact assigned`);
      return res.status(200).json({ 
        skipped: true,
        message: `Skipped ${partner.partnerName} - no main contact assigned` 
      });
    }

    const slackUserId = slackUserMapping[partner.mainContact];
    if (!slackUserId) {
      console.error(`No Slack user ID found for main contact: ${partner.mainContact}`);
      return res.status(400).json({ 
        error: `No Slack user ID configured for main contact: ${partner.mainContact}` 
      });
    }

    // Create the check-in message with interactive button
    const message = {
      channel: slackUserId,
      text: `🤝 Partner Update: ${partner.partnerName}`,
      blocks: [
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
                text: `Update ${partner.partnerName}`,
                emoji: true
              },
              style: 'primary',
              action_id: 'partner_update_button',
              value: JSON.stringify({
                partnerId: partner.id,
                partnerName: partner.partnerName,
                currentHealthScore: partner.currentHealthScore,
                previousHealthScore: partner.currentHealthScore // Will be the previous score when user updates
              })
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Triggered by: ${triggeredBy} | Partner dashboard: <${process.env.NEXTAUTH_URL || 'http://localhost:3000'}|View Dashboard>`
            }
          ]
        }
      ]
    };

    // Send the Slack message
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
        error: 'Failed to send Slack message', 
        details: slackData.error 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: `Partner check-in sent to ${partner.mainContact} for ${partner.partnerName}`,
      slackChannel: slackUserId,
      slackTimestamp: slackData.ts
    });

  } catch (error) {
    console.error('Error sending partner check-in:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}