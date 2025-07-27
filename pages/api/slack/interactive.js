import { WebClient } from '@slack/web-api';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;
  
  if (!slackToken) {
    return res.status(500).json({ error: 'Slack bot token not configured' });
  }

  try {
    // Parse the Slack payload
    const payload = JSON.parse(req.body.payload);
    const slack = new WebClient(slackToken);

    if (payload.type === 'block_actions') {
      // Handle button clicks
      const action = payload.actions[0];
      
      if (action.action_id === 'start_checkin') {
        const goalData = JSON.parse(action.value);
        
        // Open a modal for the check-in form
        await slack.views.open({
          trigger_id: payload.trigger_id,
          view: createCheckinModal(goalData)
        });
      }
    } else if (payload.type === 'view_submission') {
      // Handle modal submission
      await handleCheckinSubmission(slack, payload, channelId);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling Slack interaction:', error);
    res.status(500).json({ error: error.message });
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
          text: "3️⃣ Where would you estimate progress is? (0-100%)",
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
      }
    ]
  };
  
  await slack.chat.postMessage(summaryMessage);
  
  // Update the goal progress in the database
  await updateGoalProgress(goalData.goalId, newProgress);
  
  // Send confirmation DM to user
  await slack.chat.postMessage({
    channel: user.id,
    text: `✅ Thanks for your update! Your progress for "${goalData.goalTitle}" has been updated to ${newProgress}% and posted to the team channel.`
  });
}

async function updateGoalProgress(goalId, newProgress) {
  try {
    // Call our internal API to update the goal
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/goals/update-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        goalId,
        progress: newProgress
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update goal progress');
    }
  } catch (error) {
    console.error('Error updating goal progress:', error);
  }
}