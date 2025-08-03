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
        console.log('📅 Opening checkin modal for:', goalData.goalTitle, 'Quarter:', goalData.quarter);
        
        // Open a modal for the check-in form
        const result = await slack.views.open({
          trigger_id: payload.trigger_id,
          view: createCheckinModal(goalData)
        });
        console.log('Modal opened successfully:', result.ok);
      } else if (action.action_id === 'submit_goal_approval') {
        const goalData = JSON.parse(action.value);
        console.log('🎯 Opening goal approval modal for:', goalData.goalTitle, 'Quarter:', goalData.quarter);
        
        // Open a modal for goal approval (separate from check-in)
        const result = await slack.views.open({
          trigger_id: payload.trigger_id,
          view: createGoalApprovalModal(goalData)
        });
        console.log('Goal approval modal opened successfully:', result.ok);
      } else if (action.action_id === 'grade_goals') {
        console.log('Grading goals...');
        await handleGradeGoals(slack, payload);
      } else if (action.action_id === 'confirm_submission') {
        const data = JSON.parse(action.value);
        console.log('✅ Confirming submission for:', data.goalData.goalTitle, 'Quarter:', data.goalData.quarter);
        
        // Close the modal first
        await slack.views.update({
          view_id: payload.view.id,
          view: {
            type: "modal",
            callback_id: "submission_complete",
            title: {
              type: "plain_text",
              text: "Submitting...",
              emoji: true
            },
            close: {
              type: "plain_text",
              text: "Close",
              emoji: true
            },
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `✅ Submitting your goal approval request for "${data.goalData.goalTitle}"...`
                }
              }
            ]
          }
        });
        
        // Call the submission logic directly with the data we have
        await handleDirectGoalSubmission(slack, payload.user, data.goalData, data.submittedKRs, channelId);
        console.log('Final goal submission processed');
      } else if (action.action_id === 'grade_before_submit') {
        const data = JSON.parse(action.value);
        console.log('🎓 Grading before submit for:', data.goalData.goalTitle, 'Quarter:', data.goalData.quarter);
        
        // Grade the KRs and show feedback, then allow editing or submitting
        await handleGradeBeforeSubmit(slack, payload, data);
        console.log('Grade before submit processed');
      } else if (action.action_id === 'approve_goal') {
        const data = JSON.parse(action.value);
        console.log('✅ Manager approving goal:', data.goalTitle, 'Quarter:', data.quarter);
        
        // Handle goal approval by manager
        await handleManagerApproval(slack, payload, data);
        console.log('Manager approval processed');
      } else if (action.action_id === 'request_changes') {
        const data = JSON.parse(action.value);
        console.log('📝 Manager requesting changes for goal:', data.goalTitle, 'Quarter:', data.quarter);
        
        // Open feedback modal for manager
        const result = await slack.views.open({
          trigger_id: payload.trigger_id,
          view: createFeedbackModal(data)
        });
        console.log('Feedback modal opened successfully:', result.ok);
      }
    } else if (payload.type === 'view_submission') {
      // Handle modal submission
      console.log('Handling view submission...');
      console.log('Modal callback_id:', payload.view.callback_id);
      
      try {
        if (payload.view.callback_id === 'goal_approval') {
          const goalData = JSON.parse(payload.view.private_metadata);
          const values = payload.view.state.values;
          const user = payload.user;
          
          console.log('🎯 Goal approval modal submitted with goalData:', JSON.stringify(goalData, null, 2));
      console.log('📅 Quarter from goalData:', goalData.quarter);
          
          // Extract the KRs they submitted
          const submittedKRs = [];
          for (let i = 1; i <= 5; i++) {
            const krValue = values[`kr_${i}`]?.[`kr_${i}_input`]?.value?.trim();
            if (krValue) {
              submittedKRs.push(krValue);
            }
          }
          
          // Format KRs for display
          const krText = submittedKRs.map((kr, index) => `${index + 1}. ${kr}`).join('\n');
          
          // Send message to #reboot_os channel
          await slack.chat.postMessage({
            channel: channelId,
            text: `Goal approval request from ${user.real_name || user.name}`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*🎯 Goal Approval Request from <@${user.id}>*`
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
                    text: `*Quarter:*\n${goalData.quarter} (Planning ahead)`
                  }
                ]
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*📋 Proposed Key Results:*\n${krText}`
                }
              }
            ]
          });
          
          // Send confirmation DM to user
          await slack.chat.postMessage({
            channel: user.id,
            text: `✅ Your ${goalData.quarter} goal approval request for "${goalData.goalTitle}" has been submitted to the team channel for review.`
          });
          
          // Return empty response to close modal
          return;
        } else if (payload.view.callback_id === 'submission_confirmation') {
          // This is never reached - confirmation modal uses buttons, not submission
          console.log('Submission confirmation callback - should not happen');
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
  console.log('🚨🚨🚨 === SLACK INTERACTIVE API CALLED === 🚨🚨🚨');
  console.log('🕐 Timestamp:', new Date().toISOString());
  console.log('📝 Method:', req.method);
  console.log('📋 Content-Type:', req.headers['content-type']);
  console.log('📊 Raw body type:', typeof req.body);
  console.log('📦 Raw body:', JSON.stringify(req.body, null, 2));
  console.log('🚨🚨🚨 === END INITIAL LOG === 🚨🚨🚨');
  
  
  // Acknowledge Slack immediately to prevent timeout
  if (req.method === 'POST') {
    try {
      // Parse payload first
      let payload;
      if (typeof req.body === 'string') {
        const urlParams = new URLSearchParams(req.body);
        const payloadStr = urlParams.get('payload');
        payload = JSON.parse(payloadStr);
      } else if (req.body.payload) {
        payload = JSON.parse(req.body.payload);
      } else {
        payload = req.body;
      }
      
      // Handle view_submission directly
      if (payload.type === 'view_submission' && payload.view.callback_id === 'goal_approval') {
        const slackToken = process.env.SLACK_BOT_TOKEN;
        const channelId = process.env.SLACK_CHANNEL_ID;
        const slack = new WebClient(slackToken);
        
        const goalData = JSON.parse(payload.view.private_metadata);
        const values = payload.view.state.values;
        const user = payload.user;
        
        // Extract KRs
        const submittedKRs = [];
        for (let i = 1; i <= 5; i++) {
          const krValue = values[`kr_${i}`]?.[`kr_${i}_input`]?.value?.trim();
          if (krValue) submittedKRs.push(krValue);
        }
        
        const krText = submittedKRs.map((kr, index) => `${index + 1}. ${kr}`).join('\n');
        
        // Send to channel
        await slack.chat.postMessage({
          channel: channelId,
          text: `${goalData.quarter} Goal approval request from ${user.real_name || user.name}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn", 
                text: `*🎯 ${goalData.quarter} Goal Approval Request from <@${user.id}>*\n\n*Goal:* ${goalData.goalTitle}\n*Quarter:* ${goalData.quarter} (Planning ahead)\n\n*📋 Proposed Key Results:*\n${krText}`
              }
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "✅ Approve & Save to Notion",
                    emoji: true
                  },
                  action_id: "approve_goal",
                  style: "primary",
                  value: JSON.stringify({
                    goalId: goalData.goalId,
                    goalTitle: goalData.goalTitle,
                    submittedKRs: submittedKRs,
                    userId: user.id,
                    quarter: goalData.quarter
                  })
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "📝 Request Changes",
                    emoji: true
                  },
                  action_id: "request_changes",
                  value: JSON.stringify({
                    goalId: goalData.goalId,
                    goalTitle: goalData.goalTitle,
                    submittedKRs: submittedKRs,
                    userId: user.id,
                    quarter: goalData.quarter
                  })
                }
              ]
            }
          ]
        });
        
        // Send DM confirmation
        await slack.chat.postMessage({
          channel: user.id,
          text: `✅ Your ${goalData.quarter} goal "${goalData.goalTitle}" has been submitted for approval.`
        });
        
        return res.status(200).end();
      } else if (payload.type === 'view_submission' && payload.view.callback_id === 'manager_feedback') {
        console.log('🔄 Processing manager feedback submission...');
        const slackToken = process.env.SLACK_BOT_TOKEN;
        const slack = new WebClient(slackToken);
        
        const feedbackData = JSON.parse(payload.view.private_metadata);
        const values = payload.view.state.values;
        const manager = payload.user;
        
        console.log('Feedback data:', feedbackData);
        console.log('Manager:', manager.real_name || manager.name);
        
        // Extract feedback from modal
        const generalFeedback = values.overall_feedback?.overall_feedback_input?.value || '';
        const priorityLevel = values.priority_level?.priority_level_select?.selected_option?.value || 'medium';
        
        console.log('Extracted general feedback:', generalFeedback);
        console.log('Extracted priority level:', priorityLevel);
        
        // Extract individual KR feedback
        const krFeedback = [];
        feedbackData.submittedKRs.forEach((kr, index) => {
          const feedback = values[`kr_feedback_${index}`]?.[`kr_feedback_input_${index}`]?.value || '';
          console.log(`KR ${index + 1} feedback:`, feedback);
          if (feedback.trim()) {
            krFeedback.push(`*KR ${index + 1}:* ${kr}\n*Feedback:* ${feedback}`);
          }
        });
        
        // Format the complete feedback message
        let feedbackMessage = `🔄 *Manager Feedback for ${feedbackData.quarter} Goal "${feedbackData.goalTitle}"*\n\n`;
        feedbackMessage += `*From:* ${manager.real_name || manager.name}\n`;
        feedbackMessage += `*Priority:* ${priorityLevel === 'high' ? '🔴 High - Significant changes needed' : priorityLevel === 'medium' ? '🟡 Medium - Some revisions needed' : '🟢 Low - Minor tweaks suggested'}\n\n`;
        
        if (generalFeedback) {
          feedbackMessage += `*General Feedback:*\n${generalFeedback}\n\n`;
        }
        
        if (krFeedback.length > 0) {
          feedbackMessage += `*Key Results Feedback:*\n${krFeedback.join('\n\n')}\n\n`;
        }
        
        feedbackMessage += `Please revise your Key Results and resubmit when ready. You can use the same goal submission process as before.`;
        
        // Send DM to goal owner
        await slack.chat.postMessage({
          channel: feedbackData.userId,
          text: feedbackMessage
        });
        
        // Send confirmation to manager
        await slack.chat.postMessage({
          channel: manager.id,
          text: `✅ Your feedback for ${feedbackData.quarter} goal "${feedbackData.goalTitle}" has been sent to <@${feedbackData.userId}>.`
        });
        
        return res.status(200).end();
      } else if (payload.type === 'block_actions') {
        const slackToken = process.env.SLACK_BOT_TOKEN;
        const slack = new WebClient(slackToken);
        const action = payload.actions[0];
        
        if (action.action_id === 'approve_goal') {
          const data = JSON.parse(action.value);
          console.log('Manager approving goal:', data.goalTitle);
          
          // Handle goal approval by manager
          await handleManagerApproval(slack, payload, data);
          console.log('Manager approval processed');
          
          return res.status(200).end();
        } else if (action.action_id === 'request_changes') {
          const data = JSON.parse(action.value);
          console.log('Manager requesting changes for goal:', data.goalTitle);
          
          // Open feedback modal for manager
          const result = await slack.views.open({
            trigger_id: payload.trigger_id,
            view: createFeedbackModal(data)
          });
          console.log('Feedback modal opened successfully:', result.ok);
          
          return res.status(200).end();
        }
      }
      
      // For other interactions, process normally
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
  console.log('📅 Creating checkin modal for:', goalData.goalTitle, 'Quarter:', goalData.quarter);
  
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
  // Validate that quarter information is preserved
  if (!goalData.quarter) {
    console.warn('⚠️ Quarter missing in createGoalApprovalModal, goalData:', JSON.stringify(goalData, null, 2));
  } else {
    console.log('📅 Creating approval modal for:', goalData.goalTitle, 'Quarter:', goalData.quarter);
  }
  
  return {
    type: "modal",
    callback_id: "goal_approval",
    private_metadata: JSON.stringify(goalData),
    title: {
      type: "plain_text",
      text: "Propose Key Results",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Submit for Approval",
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
          text: `🎯 *${goalData.goalTitle}* (${goalData.quarter})

📋 *Key Results Best Practices*
Write SMART Key Results that are:
• *Specific*: Clear and well-defined outcomes, not vague statements
• *Measurable*: Include numbers, percentages, or quantifiable metrics  
• *Achievable*: Realistic given your resources and timeline
• *Relevant*: Directly supports your goal and company priorities
• *Time-bound*: Set clear deadlines (by end of quarter, by March 31st, etc.)`
        }
      },
      {
        type: "input",
        block_id: "kr_1",
        element: {
          type: "plain_text_input",
          action_id: "kr_1_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Example: Increase user engagement by 25% by end of quarter"
          }
        },
        label: {
          type: "plain_text",
          text: "Key Result 1",
          emoji: true
        }
      },
      {
        type: "input",
        block_id: "kr_2", 
        element: {
          type: "plain_text_input",
          action_id: "kr_2_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Example: Launch 3 new features by March 31st"
          }
        },
        label: {
          type: "plain_text",
          text: "Key Result 2",
          emoji: true
        }
      },
      {
        type: "input",
        block_id: "kr_3",
        element: {
          type: "plain_text_input",
          action_id: "kr_3_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Optional - Add if needed"
          }
        },
        label: {
          type: "plain_text",
          text: "Key Result 3",
          emoji: true
        },
        optional: true
      },
      {
        type: "input",
        block_id: "kr_4",
        element: {
          type: "plain_text_input",
          action_id: "kr_4_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Optional - Add if needed"
          }
        },
        label: {
          type: "plain_text",
          text: "Key Result 4",
          emoji: true
        },
        optional: true
      },
      {
        type: "input",
        block_id: "kr_5",
        element: {
          type: "plain_text_input",
          action_id: "kr_5_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Optional - Add if needed"
          }
        },
        label: {
          type: "plain_text",
          text: "Key Result 5",
          emoji: true
        },
        optional: true
      }
    ]
  };
}

function createSubmissionConfirmationModal(goalData, submittedKRs) {
  const krText = submittedKRs.map((kr, index) => `${index + 1}. ${kr}`).join('\n');
  
  return {
    type: "modal",
    callback_id: "submission_confirmation",
    private_metadata: JSON.stringify({ goalData, submittedKRs }),
    title: {
      type: "plain_text",
      text: "Ready to Submit?",
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
          text: `🎯 *${goalData.goalTitle}*\n\nYou're about to submit these Key Results:`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📋 *Your Key Results:*\n${krText}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `What would you like to do?`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ Submit Now",
              emoji: true
            },
            action_id: "confirm_submission",
            style: "primary",
            value: JSON.stringify({ goalData, submittedKRs })
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🎓 Grade First",
              emoji: true
            },
            action_id: "grade_before_submit",
            style: "secondary",
            value: JSON.stringify({ goalData, submittedKRs })
          }
        ]
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

async function handleFinalGoalSubmission(slack, payload, channelId, submittedKRs) {
  const goalData = JSON.parse(payload.view.private_metadata);
  const user = payload.user;
  
  console.log('🏁 Final goal submission received for:', goalData.goalTitle, 'Quarter:', goalData.quarter);
  console.log('📤 Submitted by:', user.real_name || user.name);
  
  // Use the provided submitted KRs (already formatted)
  const keyResults = submittedKRs.map((kr, index) => `${index + 1}. ${kr}`);
  
  console.log('Key Results submitted:', keyResults);
  
  // Format the key results for posting
  const krText = keyResults.length > 0 ? keyResults.join('\n') : 'No key results provided';
  
  // Post the goal approval request to the team channel
  const approvalMessage = {
    channel: channelId,
    text: `Goal approval request from ${user.real_name || user.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🎯 Goal Approval Request from <@${user.id}>*`
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
            text: `*Quarter:*\n${goalData.quarter || 'Current Quarter'}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📋 Proposed Key Results:*\n${krText}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Please review and provide feedback on these Key Results."
          }
        ]
      }
    ]
  };
  
  // Send the approval request to the team channel
  if (channelId) {
    await slack.chat.postMessage(approvalMessage);
    console.log('Goal approval request posted to team channel');
  }
  
  // Send confirmation DM to the user
  await slack.chat.postMessage({
    channel: user.id,
    text: `✅ Your ${goalData.quarter} goal approval request for "${goalData.goalTitle}" has been submitted! Your Key Results have been posted to the team channel for review.`
  });
  
  console.log('Goal approval submission handled successfully');
}

async function handleDirectGoalSubmission(slack, user, goalData, submittedKRs, channelId) {
  console.log('📫 Direct goal submission for:', goalData.goalTitle, 'Quarter:', goalData.quarter);
  console.log('📤 Submitted by:', user.real_name || user.name);
  
  // Format the key results for posting
  const keyResults = submittedKRs.map((kr, index) => `${index + 1}. ${kr}`);
  const krText = keyResults.length > 0 ? keyResults.join('\n') : 'No key results provided';
  
  console.log('Key Results submitted:', keyResults);
  
  // Post the goal approval request to the team channel
  const approvalMessage = {
    channel: channelId,
    text: `Goal approval request from ${user.real_name || user.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🎯 Goal Approval Request from <@${user.id}>*`
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
            text: `*Quarter:*\n${goalData.quarter || 'Current Quarter'}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📋 Proposed Key Results:*\n${krText}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Please review and provide feedback on these Key Results."
          }
        ]
      }
    ]
  };
  
  // Send the approval request to the team channel
  if (channelId) {
    await slack.chat.postMessage(approvalMessage);
    console.log('Goal approval request posted to team channel');
  }
  
  // Send confirmation DM to the user
  await slack.chat.postMessage({
    channel: user.id,
    text: `✅ Your ${goalData.quarter} goal approval request for "${goalData.goalTitle}" has been submitted! Your Key Results have been posted to the team channel for review.`
  });
  
  console.log('Direct goal submission handled successfully');
}

async function handleGradeBeforeSubmit(slack, payload, data) {
  try {
    const { goalData, submittedKRs } = data;
    
    // Convert submitted KRs to format expected by OpenAI
    const keyResults = submittedKRs.map((kr, index) => ({
      number: index + 1,
      text: kr
    }));
    
    console.log('🎓 Grading KRs before submit for:', goalData.goalTitle, 'Quarter:', goalData.quarter);
    console.log('📝 Key Results to grade:', keyResults.length, 'items');
    
    // Grade the goals using OpenAI API
    const feedback = await gradeGoalsWithOpenAI(keyResults, goalData.goalTitle);
    
    // Create modal with KRs and feedback, plus submit option
    // Convert submittedKRs to the format expected by the feedback modal
    const mockFormValues = {};
    submittedKRs.forEach((kr, index) => {
      mockFormValues[`kr_${index + 1}`] = {
        [`kr_${index + 1}_input`]: {
          value: kr
        }
      };
    });
    
    const feedbackModal = createGoalApprovalModalWithFeedback(goalData, mockFormValues, feedback);
    
    // Update the current modal to show feedback
    await slack.views.update({
      view_id: payload.view.id,
      view: feedbackModal
    });
    
    console.log('Updated modal with AI feedback');
    
  } catch (error) {
    console.error('Error grading before submit:', error);
    
    await slack.chat.postMessage({
      channel: payload.user.id,
      text: `❌ Sorry, there was an error grading your goals. You can still submit them as-is if you'd like.`
    });
  }
}

async function handleGradeGoals(slack, payload) {
  try {
    const values = payload.view.state.values;
    const goalData = JSON.parse(payload.view.private_metadata);
    
    // Extract current KR values from the modal
    const keyResults = [];
    for (let i = 1; i <= 5; i++) {
      const krValue = values[`kr_${i}`]?.[`kr_${i}_input`]?.value?.trim();
      if (krValue) {
        keyResults.push({ number: i, text: krValue });
      }
    }
    
    console.log(`🎓 Grading ${keyResults.length} key results for ${goalData.quarter} goal: ${goalData.goalTitle}`);
    
    // Grade the goals using OpenAI API
    const feedback = await gradeGoalsWithOpenAI(keyResults, goalData.goalTitle);
    
    // Update the modal with feedback
    const updatedModal = createGoalApprovalModalWithFeedback(goalData, values, feedback);
    
    await slack.views.update({
      view_id: payload.view.id,
      view: updatedModal
    });
    
    console.log('Modal updated with Claude feedback');
    
  } catch (error) {
    console.error('Error grading goals:', error);
    
    // Send error message to user
    await slack.chat.postMessage({
      channel: payload.user.id,
      text: `❌ Sorry, there was an error grading your goals. Please try again or submit without grading.`
    });
  }
}

async function gradeGoalsWithOpenAI(keyResults, goalTitle) {
  const OpenAI = require('openai');
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const krText = keyResults.map(kr => `${kr.number}. ${kr.text}`).join('\n');
  
  const prompt = `Please grade these Key Results for the goal "${goalTitle}" based on SMART criteria. 

Note: RebootOS only grades Specific, Measurable, and Time-bound criteria. We do not evaluate Achievable or Relevant as those depend on business context.

Key Results to grade:
${krText}

For each Key Result, provide:
- ✅ or ❌ for Specific (is it clear and well-defined?)
- ✅ or ❌ for Measurable (can progress be quantified?)  
- ✅ or ❌ for Time-bound (does it have a clear deadline?)
- 💡 Brief suggestion for improvement (if needed)

Keep feedback concise and actionable. Format as JSON with this structure:
{
  "results": [
    {
      "number": 1,
      "specific": true,
      "measurable": false, 
      "timeBound": true,
      "suggestion": "Add a specific metric to measure success"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 1000,
    temperature: 0.1
  });
  
  // Parse OpenAI's response
  try {
    const responseText = completion.choices[0].message.content;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in OpenAI response');
    }
  } catch (parseError) {
    console.error('Error parsing OpenAI response:', parseError);
    console.log('Raw OpenAI response:', completion.choices[0].message.content);
    throw new Error('Failed to parse OpenAI feedback');
  }
}

function createGoalApprovalModalWithFeedback(goalData, currentValues, feedback) {
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎯 *${goalData.goalTitle}*

📋 *Key Results Best Practices*
Write SMART Key Results that are:
• *Specific*: Clear and well-defined outcomes, not vague statements
• *Measurable*: Include numbers, percentages, or quantifiable metrics  
• *Achievable*: Realistic given your resources and timeline
• *Relevant*: Directly supports your goal and company priorities
• *Time-bound*: Set clear deadlines (by end of quarter, by March 31st, etc.)`
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🎓 Grade My Goals",
            emoji: true
          },
          action_id: "grade_goals",
          style: "secondary"
        }
      ]
    }
  ];

  // Add each KR input with feedback below it
  for (let i = 1; i <= 5; i++) {
    const isRequired = i <= 2;
    const currentValue = currentValues[`kr_${i}`]?.[`kr_${i}_input`]?.value || '';
    
    // Add the input field
    blocks.push({
      type: "input",
      block_id: `kr_${i}`,
      element: {
        type: "plain_text_input",
        action_id: `kr_${i}_input`,
        multiline: true,
        initial_value: currentValue,
        placeholder: {
          type: "plain_text",
          text: i === 1 ? "Example: Increase user engagement by 25% by end of quarter" 
               : i === 2 ? "Example: Launch 3 new features by March 31st"
               : "Optional - Add if needed"
        }
      },
      label: {
        type: "plain_text",
        text: `Key Result ${i}${isRequired ? ' *' : ''}`,
        emoji: true
      },
      optional: !isRequired
    });

    // Add feedback if available for this KR
    const krFeedback = feedback?.results?.find(r => r.number === i);
    if (krFeedback && currentValue) {
      const specificIcon = krFeedback.specific ? '✅' : '❌';
      const measurableIcon = krFeedback.measurable ? '✅' : '❌';
      const timeBoundIcon = krFeedback.timeBound ? '✅' : '❌';
      
      let feedbackText = `📊 *SMART Analysis:*\n${specificIcon} Specific | ${measurableIcon} Measurable | ${timeBoundIcon} Time-bound`;
      
      if (krFeedback.suggestion) {
        feedbackText += `\n💡 ${krFeedback.suggestion}`;
      }
      
      feedbackText += `\n\n_Note: RebootOS doesn't grade Achievable or Relevant as these depend on your business context._`;

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: feedbackText
        }
      });
    }
  }

  return {
    type: "modal",
    callback_id: "goal_approval",
    private_metadata: JSON.stringify(goalData),
    title: {
      type: "plain_text",
      text: "Propose Key Results",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Submit for Approval",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    blocks: blocks
  };
}

async function handleManagerApproval(slack, payload, data) {
  const { goalId, goalTitle, submittedKRs, userId, quarter } = data;
  const manager = payload.user;
  
  try {
    
    console.log('🎯 Processing manager approval for goal:', goalTitle, 'Quarter:', quarter);
    console.log('🔍 Original goalId (might be temp-id):', goalId);
    console.log('📊 Full data object:', JSON.stringify(data, null, 2));
    
    // Validate quarter is provided - this should not happen in normal workflow
    let actualQuarter = quarter;
    if (!actualQuarter) {
      console.error('🚨 CRITICAL: Quarter is undefined in manager approval workflow!');
      console.error('🚨 This indicates a bug in the goal submission process');
      console.error('🚨 Goal data:', JSON.stringify(data, null, 2));
      
      // Send error to manager immediately
      await slack.chat.postMessage({
        channel: manager.id,
        text: `❌ Error: Unable to approve goal "${goalTitle}" - quarter information is missing. Please contact support.`
      });
      
      throw new Error(`Quarter information missing for goal: ${goalTitle}. This should not happen - please check the goal submission workflow.`);
    }
    
    console.log('✅ Quarter validation passed:', actualQuarter);
    
    const notionToken = process.env.NOTION_TOKEN;
    const databaseId = process.env.NOTION_DATABASE_ID || '238ee4a677df80c18e68d094de3fd6d6';
    
    // First, search for the actual goal by project title and quarter
    const searchResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: {
          and: [
            {
              property: "Project",
              title: {
                equals: goalTitle
              }
            },
            {
              property: "Quarter",
              select: {
                equals: actualQuarter
              }
            }
          ]
        }
      })
    });

    if (!searchResponse.ok) {
      throw new Error(`Failed to search for goal: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    console.log(`Found ${searchData.results.length} matching goals`);
    
    if (searchData.results.length === 0) {
      throw new Error(`No goal found with title "${goalTitle}" and quarter "${actualQuarter}"`);
    }
    
    if (searchData.results.length > 1) {
      console.warn(`Multiple goals found with title "${goalTitle}" and quarter "${actualQuarter}". Using the first one.`);
    }
    
    const actualGoalId = searchData.results[0].id;
    console.log('Actual goal ID found:', actualGoalId);
    
    // Now update the correct goal with approved KRs
    const krText = submittedKRs.join('\n');
    
    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${actualGoalId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        properties: {
          'Open KRs': {
            rich_text: [{ text: { content: krText } }]
          }
        }
      })
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.text();
      throw new Error(`Failed to update Notion goal: ${updateResponse.status} - ${errorData}`);
    }
    
    console.log('Successfully updated goal with approved KRs');

    // Update the original message to show it's been approved
    await slack.chat.update({
      channel: payload.channel.id,
      ts: payload.message.ts,
      text: `Goal approved by ${manager.real_name || manager.name}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ *Goal Approved by <@${manager.id}>*\n\n*Goal:* ${goalTitle}\n\n*📋 Approved Key Results:*\n${submittedKRs.map((kr, index) => `${index + 1}. ${kr}`).join('\n')}`
          }
        }
      ]
    });

    // Send confirmation DM to goal owner
    await slack.chat.postMessage({
      channel: userId,
      text: `🎉 Great news! Your ${actualQuarter} goal "${goalTitle}" has been approved by ${manager.real_name || manager.name} and your Key Results have been saved to Notion.`
    });

    console.log('Manager approval completed successfully');
  } catch (error) {
    console.error('🚨 Error in handleManagerApproval:', error);
    console.error('📋 Goal details - Title:', goalTitle, 'Quarter:', quarter);
    console.error('❌ Error details:', error.message);
    console.error('📚 Error stack:', error.stack);
    
    // Send error message to manager with quarter context
    try {
      await slack.chat.postMessage({
        channel: manager.id,
        text: `❌ Error approving ${quarter || 'unknown quarter'} goal "${goalTitle}": ${error.message}`
      });
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }
    
    throw error;
  }
}

function createFeedbackModal(data) {
  const { goalTitle, submittedKRs } = data;
  
  return {
    type: "modal",
    callback_id: "manager_feedback",
    private_metadata: JSON.stringify(data),
    title: {
      type: "plain_text",
      text: "Request Changes",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Send Feedback",
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
          text: `🎯 *${goalTitle}*\n\nProvide feedback on the proposed Key Results:`
        }
      },
      {
        type: "input",
        block_id: "overall_feedback",
        element: {
          type: "plain_text_input",
          action_id: "overall_feedback_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Overall feedback on the goal and Key Results..."
          }
        },
        label: {
          type: "plain_text",
          text: "Overall Feedback",
          emoji: true
        }
      },
      ...submittedKRs.map((kr, index) => ({
        type: "input",
        block_id: `kr_feedback_${index}`,
        element: {
          type: "plain_text_input",
          action_id: `kr_feedback_input_${index}`,
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Specific feedback for this Key Result..."
          }
        },
        label: {
          type: "plain_text",
          text: `Feedback for KR ${index + 1}: "${kr.substring(0, 50)}${kr.length > 50 ? '...' : ''}"`,
          emoji: true
        },
        optional: true
      })),
      {
        type: "input",
        block_id: "priority_level",
        element: {
          type: "static_select",
          action_id: "priority_level_select",
          placeholder: {
            type: "plain_text",
            text: "Select priority level"
          },
          options: [
            {
              text: {
                type: "plain_text",
                text: "🔴 High - Major changes needed"
              },
              value: "high"
            },
            {
              text: {
                type: "plain_text",
                text: "🟡 Medium - Some improvements needed"
              },
              value: "medium"
            },
            {
              text: {
                type: "plain_text",
                text: "🟢 Low - Minor tweaks suggested"
              },
              value: "low"
            }
          ]
        },
        label: {
          type: "plain_text",
          text: "Priority Level",
          emoji: true
        }
      }
    ]
  };
}


