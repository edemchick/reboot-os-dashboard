import { WebClient } from '@slack/web-api';

async function processSlackInteraction(req) {
  console.log('🚨🚨🚨 === Processing Slack Interaction Async === 🚨🚨🚨');
  
  const slackToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;
  
  if (!slackToken) {
    console.error('SLACK_BOT_TOKEN not configured');
    return;
  }

  try {
    // Parse the Slack payload
    console.log('Parsing payload...');
    let payload;
    
    if (typeof req.body === 'string') {
      // If body is a string, it might be form-encoded
      const urlParams = new URLSearchParams(req.body);
      const payloadStr = urlParams.get('payload');
      console.log('Found payload string:', payloadStr?.substring(0, 200) + '...');
      payload = JSON.parse(payloadStr);
    } else if (req.body.payload) {
      // If body is an object with payload property
      payload = JSON.parse(req.body.payload);
    } else {
      // If body is already the payload object
      payload = req.body;
    }
    
    console.log('Payload type:', payload.type);
    console.log('Payload keys:', Object.keys(payload));
    
    const slack = new WebClient(slackToken);

    if (payload.type === 'block_actions') {
      // Handle button clicks
      console.log('Handling block action...');
      const action = payload.actions[0];
      console.log('Action ID:', action.action_id);
      console.log('Action value:', action.value);
      console.log('Trigger ID:', payload.trigger_id);
      
      // Debug: Log ALL action IDs we receive
      if (action.action_id === 'submit_goal_approval') {
        console.log('🎯 FOUND submit_goal_approval action!');
      } else {
        console.log('❌ Action ID is NOT submit_goal_approval, it is:', action.action_id);
      }
      
      if (action.action_id === 'start_checkin') {
        const goalData = JSON.parse(action.value);
        console.log('Opening modal for goal:', goalData.goalTitle);
        
        // Open a modal for the check-in form
        const result = await slack.views.open({
          trigger_id: payload.trigger_id,
          view: createCheckinModal(goalData)
        });
        console.log('Modal opened successfully:', result.ok);
      } else if (action.action_id === 'submit_goal_approval') {
        const goalData = JSON.parse(action.value);
        console.log('Opening goal approval modal for goal:', goalData.goalTitle);
        
        // Open a modal for goal approval (using working function temporarily)
        const result = await slack.views.open({
          trigger_id: payload.trigger_id,
          view: createCheckinModal(goalData)
        });
        console.log('Goal approval modal opened successfully:', result.ok);
      }
    } else if (payload.type === 'view_submission') {
      // Handle modal submission
      console.log('Handling view submission...');
      console.log('Modal callback_id:', payload.view.callback_id);
      
      try {
        if (payload.view.callback_id === 'goal_approval') {
          // Handle goal approval submission (separate from check-in)
          await handleGoalApprovalSubmission(slack, payload, channelId);
          console.log('Goal approval submission handled successfully');
        } else {
          // Handle regular check-in submission
          await handleCheckinSubmission(slack, payload, channelId);
          console.log('Check-in submission handled successfully');
        }
      } catch (error) {
        console.error('Error handling submission:', error);
      }
    }

    console.log('Slack interaction processed successfully');
  } catch (error) {
    console.error('=== Slack Interactive Error ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Raw request body:', req.body);
  }
}

// Configure API route to handle form data
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}

export default async function handler(req, res) {
  console.log('🚨 === SLACK INTERACTIVE API CALLED === 🚨');
  console.log('🕐 Timestamp:', new Date().toISOString());
  console.log('📝 Method:', req.method);
  console.log('📋 Content-Type:', req.headers['content-type']);
  console.log('📊 Raw body type:', typeof req.body);
  console.log('📦 Raw body:', JSON.stringify(req.body, null, 2));
  
  
  // Acknowledge Slack immediately to prevent timeout
  if (req.method === 'POST') {
    console.log('Setting up async processing...');
    
    try {
      // Process the request synchronously to catch errors
      await processSlackInteraction(req);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('🚨 Handler error:', error);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

}

function createCheckinModal(goalData) {
  return {
    type: "modal",
    callback_id: "goal_checkin",
    private_metadata: JSON.stringify(goalData),
    title: {
      type: "plain_text",
      text: "Weekly Goal Check-in",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Submit Update",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎯 *${goalData.goalTitle}*\nCurrent: ${goalData.currentProgress}% | Expected: ${goalData.expectedProgress}%`
        }
      },
      {
        type: "input",
        block_id: "went_well",
        element: {
          type: "plain_text_input",
          action_id: "went_well_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What progress did you make this week?"
          }
        },
        label: {
          type: "plain_text",
          text: "1️⃣ What went well this week?",
          emoji: true
        }
      },
      {
        type: "input",
        block_id: "challenges",
        element: {
          type: "plain_text_input",
          action_id: "challenges_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What blockers or challenges did you face?"
          }
        },
        label: {
          type: "plain_text",
          text: "2️⃣ What didn't go well this week?",
          emoji: true
        }
      },
      {
        type: "input",
        block_id: "completed_krs",
        element: {
          type: "plain_text_input",
          action_id: "completed_krs_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "List any KRs that should be moved to completed status"
          }
        },
        label: {
          type: "plain_text",
          text: "3️⃣ Are there any KRs that should move over to complete?",
          emoji: true
        },
        optional: true
      },
      {
        type: "input",
        block_id: "progress_estimate",
        element: {
          type: "number_input",
          action_id: "progress_input",
          is_decimal_allowed: false,
          min_value: "0",
          max_value: "100",
          initial_value: goalData.currentProgress.toString()
        },
        label: {
          type: "plain_text",
          text: "4️⃣ Where would you estimate progress is? (0-100%)",
          emoji: true
        }
      }
    ]
  };
}

function createGoalApprovalModal(goalData) {
  return {
    type: "modal",
    callback_id: "goal_approval",
    private_metadata: JSON.stringify(goalData),
    title: {
      type: "plain_text",
      text: "Weekly Goal Check-in",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Submit Update",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎯 *${goalData.goalTitle}*\nCurrent: ${goalData.currentProgress}% | Expected: ${goalData.expectedProgress}%`
        }
      },
      {
        type: "input",
        block_id: "went_well",
        element: {
          type: "plain_text_input",
          action_id: "went_well_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What progress did you make this week?"
          }
        },
        label: {
          type: "plain_text",
          text: "1️⃣ What went well this week?",
          emoji: true
        }
      },
      {
        type: "input",
        block_id: "challenges",
        element: {
          type: "plain_text_input",
          action_id: "challenges_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What blockers or challenges did you face?"
          }
        },
        label: {
          type: "plain_text",
          text: "2️⃣ What didn't go well this week?",
          emoji: true
        }
      },
      {
        type: "input",
        block_id: "completed_krs",
        element: {
          type: "plain_text_input",
          action_id: "completed_krs_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "List any KRs that should be moved to completed status"
          }
        },
        label: {
          type: "plain_text",
          text: "3️⃣ Are there any KRs that should move over to complete?",
          emoji: true
        },
        optional: true
      },
      {
        type: "input",
        block_id: "progress_estimate",
        element: {
          type: "number_input",
          action_id: "progress_input",
          is_decimal_allowed: false,
          min_value: "0",
          max_value: "100",
          initial_value: goalData.currentProgress.toString()
        },
        label: {
          type: "plain_text",
          text: "4️⃣ Where would you estimate progress is? (0-100%)",
          emoji: true
        }
      }
    ]
  };
}

async function handleCheckinSubmission(slack, payload, channelId) {
  const goalData = JSON.parse(payload.view.private_metadata);
  const values = payload.view.state.values;
  
  // Extract form responses
  const wentWell = values.went_well.went_well_input.value;
  const challenges = values.challenges.challenges_input.value;
  const completedKRs = values.completed_krs.completed_krs_input.value || '';
  const newProgress = parseInt(values.progress_estimate.progress_input.value);
  
  const user = payload.user;
  const progressChange = newProgress - goalData.currentProgress;
  const progressEmoji = progressChange > 0 ? '📈' : progressChange < 0 ? '📉' : '➡️';
  
  // Post summary to the channel
  const summaryMessage = {
    channel: channelId,
    text: `Goal update from ${user.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Goal Update from <@${user.id}>* ${progressEmoji}`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Goal:*\n${goalData.goalTitle}`
          },
          {
            type: "mrkdwn",
            text: `*Progress:*\n${goalData.currentProgress}% → ${newProgress}%`
          }
        ]
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*✅ What went well:*\n${wentWell}`
          },
          {
            type: "mrkdwn",
            text: `*⚠️ Challenges:*\n${challenges}`
          }
        ]
      },
      ...(completedKRs ? [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🎯 KRs to mark complete:*\n${completedKRs}`
        }
      }] : [])
    ]
  };
  
  await slack.chat.postMessage(summaryMessage);
  
  // Update progress in Notion
  try {
    console.log('=== Updating Notion Progress ===');
    console.log('Goal ID:', goalData.goalId);
    console.log('Goal Title:', goalData.goalTitle);
    console.log('New Progress:', newProgress);
    console.log('Update Data:', { wentWell, challenges, completedKRs });
    
    const notionToken = process.env.NOTION_TOKEN;
    
    const response = await fetch(`https://api.notion.com/v1/pages/${goalData.goalId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        properties: {
          Progress: {
            number: newProgress / 100
          },
          'Latest Update Date': {
            date: {
              start: new Date().toISOString().split('T')[0]
            }
          },
          'Latest Update - What Went Well': {
            rich_text: [{ text: { content: wentWell } }]
          },
          'Latest Update - Challenges': {
            rich_text: [{ text: { content: challenges } }]
          },
          'Latest Update - Completed KRs': {
            rich_text: [{ text: { content: completedKRs } }]
          }
        }
      })
    });

    if (response.ok) {
      console.log('✅ Notion progress and updates saved successfully');
    } else {
      const errorData = await response.text();
      console.error('❌ Notion update failed:', response.status, errorData);
      console.error('Request body was:', JSON.stringify({
        properties: {
          Progress: { number: newProgress / 100 },
          'Latest Update Date': { date: { start: new Date().toISOString().split('T')[0] } },
          'Latest Update - What Went Well': { rich_text: [{ text: { content: wentWell } }] },
          'Latest Update - Challenges': { rich_text: [{ text: { content: challenges } }] },
          'Latest Update - Completed KRs': { rich_text: [{ text: { content: completedKRs } }] }
        }
      }, null, 2));
    }
    
  } catch (error) {
    console.error('Error updating Notion progress:', error);
  }
  
  // Send confirmation DM to user
  await slack.chat.postMessage({
    channel: user.id,
    text: `✅ Thanks for your update! Your progress for "${goalData.goalTitle}" has been updated to ${newProgress}% and posted to the team channel.`
  });
}

async function handleGoalApprovalSubmission(slack, payload, channelId) {
  const goalData = JSON.parse(payload.view.private_metadata);
  const values = payload.view.state.values;
  const user = payload.user;
  
  console.log('Goal approval submission received for:', goalData.goalTitle);
  console.log('Submitted by:', user.real_name || user.name);
  
  // TODO: Add your custom logic here later
  // For now, just send a placeholder confirmation
  await slack.chat.postMessage({
    channel: user.id,
    text: `✅ Goal approval submission received for "${goalData.goalTitle}"! This is a placeholder - custom logic will be added later.`
  });
}


