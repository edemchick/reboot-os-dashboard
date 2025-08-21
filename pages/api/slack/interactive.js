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
    
    // Configure WebClient with retry and timeout settings for better reliability
    const slack = new WebClient(slackToken, {
      retryConfig: {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 30000
      },
      timeout: 30000, // 30 second timeout
      agent: undefined // Use default agent, let Node.js handle connection pooling
    });

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
      } else if (action.action_id === 'partner_update_button') {
        const partnerData = JSON.parse(action.value);
        console.log('🤝 Opening partner update modal for:', partnerData.partnerName);
        
        // Open a modal for partner health update
        const result = await slack.views.open({
          trigger_id: payload.trigger_id,
          view: createPartnerUpdateModal(partnerData)
        });
        console.log('Partner update modal opened successfully:', result.ok);
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
        } else if (payload.view.callback_id === 'partner_update') {
          // Handle partner update submission
          await handlePartnerUpdateSubmission(slack, payload);
          console.log('Partner update submission handled successfully');
        } else {
          // Other view submissions - should not happen as they're handled directly in main handler
          console.log('Unhandled view submission callback_id:', payload.view.callback_id);
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
  console.log('🚨🚨🚨 === TIMESTAMP:', new Date().toISOString(), '=== 🚨🚨🚨');
  console.log('🕐 Timestamp:', new Date().toISOString());
  console.log('📝 Method:', req.method);
  console.log('📋 Content-Type:', req.headers['content-type']);
  console.log('📊 Raw body type:', typeof req.body);
  console.log('📦 Raw body:', JSON.stringify(req.body, null, 2));
  console.log('🚨🚨🚨 === END INITIAL LOG === 🚨🚨🚨');
  
  // Force flush logs immediately
  if (typeof console.flush === 'function') {
    console.flush();
  }
  
  
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
        const slack = new WebClient(slackToken, {
          retryConfig: {
            retries: 3,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 30000
          },
          timeout: 30000,
          agent: undefined
        });
        
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
                    text: "✅ Approve",
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
      } else if (payload.type === 'view_submission' && payload.view.callback_id === 'goal_checkin') {
        console.log('📅 Processing check-in submission...');
        const slackToken = process.env.SLACK_BOT_TOKEN;
        const channelId = process.env.SLACK_CHANNEL_ID;
        const slack = new WebClient(slackToken, {
          retryConfig: {
            retries: 3,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 30000
          },
          timeout: 30000,
          agent: undefined
        });
        
        // Handle check-in submission synchronously to prevent function termination
        console.log('🚀 Starting check-in submission with channelId:', channelId);
        
        // Add timeout protection (Vercel has 10s timeout on hobby plan)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Function timeout - operation took too long')), 8000)
        );
        
        try {
          await Promise.race([
            handleCheckinSubmission(slack, payload, channelId),
            timeoutPromise
          ]);
          console.log('✅ Check-in submission handled successfully');
          console.log('✅ FINAL SUCCESS - all operations completed');
        } catch (error) {
          console.error('❌ Check-in submission error:', error);
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
          console.error('❌ FINAL ERROR - submission failed completely');
          
          // Send error DM to user as fallback
          try {
            await slack.chat.postMessage({
              channel: payload.user.id,
              text: `❌ Sorry, there was an error processing your goal update. Please try again or contact support. Error: ${error.message}`
            });
          } catch (dmError) {
            console.error('Failed to send error DM:', dmError);
          }
        }
        
        return res.status(200).end();
      } else if (payload.type === 'view_submission' && payload.view.callback_id === 'partner_update') {
        console.log('🤝 Processing partner update submission...');
        const slackToken = process.env.SLACK_BOT_TOKEN;
        const slack = new WebClient(slackToken, {
          retryConfig: {
            retries: 3,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 30000
          },
          timeout: 30000,
          agent: undefined
        });
        
        const partnerData = JSON.parse(payload.view.private_metadata);
        const values = payload.view.state.values;
        const user = payload.user;
        
        // Extract form responses
        const healthScore = parseInt(values.health_score.health_score_select.selected_option.value);
        const keyUpdates = values.key_updates.key_updates_input.value;
        const currentHurdles = values.current_hurdles.current_hurdles_input.value || '';
        const actionItems = values.action_items.action_items_input.value || '';
        
        console.log('🤝 Partner update data:', {
          partner: partnerData.partnerName,
          healthScore,
          keyUpdates,
          currentHurdles,
          actionItems
        });
        
        // Handle partner update submission
        await handlePartnerUpdateSubmission(slack, payload);
        console.log('Partner update submission handled successfully');
        
        return res.status(200).end();
      } else if (payload.type === 'view_submission' && payload.view.callback_id === 'manager_feedback') {
        console.log('🔄 Processing manager feedback submission...');
        const slackToken = process.env.SLACK_BOT_TOKEN;
        const slack = new WebClient(slackToken, {
          retryConfig: {
            retries: 3,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 30000
          },
          timeout: 30000,
          agent: undefined
        });
        
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
        const slack = new WebClient(slackToken, {
          retryConfig: {
            retries: 3,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 30000
          },
          timeout: 30000,
          agent: undefined
        });
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

// Helper function to convert HTML links to Slack markdown format
function convertHtmlToSlackMarkdown(htmlText) {
  if (!htmlText) return '';
  
  // Convert HTML links to Slack markdown format
  // From: <a href="https://example.com" target="_blank" rel="noopener noreferrer" class="...">Link Text</a>
  // To: <https://example.com|Link Text>
  return htmlText.replace(
    /<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g, 
    '<$1|$2>'
  );
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
      ...(goalData.keyResults ? [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📋 *Open Key Results:*\n${convertHtmlToSlackMarkdown(goalData.keyResults)}`
        }
      }] : []),
      ...(goalData.completedKRs ? [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Completed Key Results:*\n${convertHtmlToSlackMarkdown(goalData.completedKRs)}`
        }
      }] : []),
      ...(goalData.keyResults || goalData.completedKRs ? [{
        type: "divider"
      }] : []),
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
          text: `1️⃣ Where would you estimate progress is? (Currently: ${goalData.currentProgress}%)`,
          emoji: true
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
          text: "2️⃣ What went well this week?",
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
          text: "3️⃣ What didn't go well this week?",
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
          text: "4️⃣ Are there any KRs that should move over to complete?",
          emoji: true
        },
        optional: true
      },
      {
        type: "input",
        block_id: "next_week_focus",
        element: {
          type: "plain_text_input",
          action_id: "next_week_focus_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What are your key priorities for next week?"
          }
        },
        label: {
          type: "plain_text",
          text: "5️⃣ What are we focusing on next week?",
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
  console.log('🎯 handleCheckinSubmission started');
  console.log('📍 Channel ID received:', channelId);
  console.log('👤 User:', payload.user.id, payload.user.name);
  
  const goalData = JSON.parse(payload.view.private_metadata);
  const values = payload.view.state.values;
  
  console.log('📋 Goal data:', goalData.goalTitle);
  console.log('📊 Form values keys:', Object.keys(values));
  
  // Extract form responses
  const wentWell = values.went_well.went_well_input.value;
  const challenges = values.challenges.challenges_input.value;
  const completedKRs = values.completed_krs.completed_krs_input.value || '';
  const nextWeekFocus = values.next_week_focus.next_week_focus_input.value || '';
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
      }] : []),
      ...(nextWeekFocus ? [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📅 Next week focus:*\n${nextWeekFocus}`
        }
      }] : [])
    ]
  };
  
  console.log('📨 About to post message to channel:', channelId);
  console.log('📝 Message summary:', summaryMessage.text);
  
  // Validate channel ID
  if (!channelId) {
    console.error('❌ CRITICAL: Channel ID is undefined or empty!');
    console.error('Environment variables:', {
      SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID,
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ? 'SET' : 'NOT SET'
    });
    throw new Error('Channel ID is not configured');
  }
  
  if (!channelId.startsWith('C')) {
    console.warn('⚠️ Channel ID format warning - expected to start with "C", got:', channelId);
  }
  
  // Simple retry with shorter delays for serverless environment
  let attempt = 0;
  const maxAttempts = 2; // Reduced attempts to stay within timeout
  let lastError;
  
  while (attempt < maxAttempts) {
    try {
      attempt++;
      console.log(`🚀 Attempt ${attempt}/${maxAttempts} - Calling slack.chat.postMessage`);
      
      // Add timeout to the Slack API call itself
      const slackPromise = slack.chat.postMessage(summaryMessage);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Slack API timeout')), 5000)
      );
      
      const result = await Promise.race([slackPromise, timeoutPromise]);
      console.log('✅ Message posted successfully to channel');
      console.log('📊 Slack API response success:', result.ok);
      break; // Success, exit retry loop
      
    } catch (slackError) {
      lastError = slackError;
      console.error(`❌ Attempt ${attempt}/${maxAttempts} failed:`, slackError.message);
      
      if (attempt === maxAttempts) {
        console.error('❌ Final error - not retrying:', slackError);
        console.error('Full error object:', JSON.stringify(slackError, null, 2));
        throw slackError;
      }
      
      // Short wait before retry
      const delay = 1000; // Just 1 second
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Update progress in Notion
  try {
    console.log('=== Updating Notion Progress ===');
    console.log('Goal ID:', goalData.goalId);
    console.log('Goal Title:', goalData.goalTitle);
    console.log('New Progress:', newProgress);
    console.log('Update Data:', { wentWell, challenges, completedKRs, nextWeekFocus });
    
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
              start: new Date().toLocaleDateString('en-CA')
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
          },
          'Latest Update - Next Week': {
            rich_text: [{ text: { content: nextWeekFocus } }]
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
    text: `✅ Thanks for your update! Your progress for "${goalData.goalTitle}" has been updated to ${newProgress}%.`
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
    const krText = submittedKRs.map(kr => `-${kr}`).join('\n\n');
    
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

function createPartnerUpdateModal(partnerData) {
  console.log('🤝 Creating partner update modal for:', partnerData.partnerName);
  
  return {
    type: "modal",
    callback_id: "partner_update",
    private_metadata: JSON.stringify(partnerData),
    title: {
      type: "plain_text",
      text: "Partner Health Update",
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
          text: `🤝 *${partnerData.partnerName}*\nPrevious Health Score: ${partnerData.currentHealthScore}/10`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `💡 *Health Score Guidance:*\nTo determine the health score, think 'How disappointed would this partner be if they could no longer work with Reboot?' The closer you are to extremely disappointed, the closer they are to a 10.`
        }
      },
      {
        type: "input",
        block_id: "health_score",
        element: {
          type: "static_select",
          action_id: "health_score_select",
          initial_option: {
            text: {
              type: "plain_text",
              text: `${partnerData.currentHealthScore}/10`
            },
            value: partnerData.currentHealthScore.toString()
          },
          options: Array.from({length: 11}, (_, i) => ({
            text: {
              type: "plain_text",
              text: `${i}/10`
            },
            value: i.toString()
          }))
        },
        label: {
          type: "plain_text",
          text: "Health Score (0-10)",
          emoji: true
        }
      },
      {
        type: "input",
        block_id: "key_updates",
        element: {
          type: "plain_text_input",
          action_id: "key_updates_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What are the key updates or developments with this partner?"
          }
        },
        label: {
          type: "plain_text",
          text: "Key Updates",
          emoji: true
        }
      },
      {
        type: "input",
        block_id: "current_hurdles",
        element: {
          type: "plain_text_input",
          action_id: "current_hurdles_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What is stopping this partner from scoring a 10/10?"
          }
        },
        label: {
          type: "plain_text",
          text: "Current Hurdles",
          emoji: true
        }
      },
      {
        type: "input",
        block_id: "action_items",
        element: {
          type: "plain_text_input",
          action_id: "action_items_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What action items or next steps are needed?"
          }
        },
        label: {
          type: "plain_text",
          text: "Action Items",
          emoji: true
        },
        optional: true
      }
    ]
  };
}

async function handlePartnerUpdateSubmission(slack, payload) {
  const partnerData = JSON.parse(payload.view.private_metadata);
  const values = payload.view.state.values;
  const user = payload.user;
  
  // Extract form responses
  const healthScore = parseInt(values.health_score.health_score_select.selected_option.value);
  const keyUpdates = values.key_updates.key_updates_input.value;
  const currentHurdles = values.current_hurdles.current_hurdles_input.value || '';
  const actionItems = values.action_items.action_items_input.value || '';
  
  console.log('🤝 Partner update submission:', {
    partner: partnerData.partnerName,
    partnerId: partnerData.partnerId,
    healthScore,
    previousHealthScore: partnerData.currentHealthScore,
    keyUpdates,
    currentHurdles,
    actionItems
  });
  
  try {
    // Get the submitting user's Notion ID
    const submittedByNotionId = await getNotionUserIdFromSlack(user);
    console.log('🔍 Submitting user Notion ID:', submittedByNotionId);
    
    // Save to Notion partner updates database
    const notionToken = process.env.NOTION_TOKEN;
    const updatesDbId = process.env.NOTION_PARTNER_UPDATES_DATABASE_ID;
    
    console.log('Database check:', {
      hasToken: !!notionToken,
      updatesDbId: updatesDbId
    });
    
    if (!updatesDbId) {
      console.error('NOTION_PARTNER_UPDATES_DATABASE_ID not configured');
      throw new Error('Partner updates database not configured');
    }
    
    console.log('🔄 Making Notion API call...');
    
    const requestBody = {
      parent: { database_id: updatesDbId },
      properties: {
        'Partner': {
          relation: [{ id: partnerData.partnerId }]
        },
        'Update Date': {
          date: {
            start: new Date().toISOString().split('T')[0]
          }
        },
        'Health Score': {
          number: healthScore
        },
        'Previous Health Score': {
          number: partnerData.currentHealthScore
        },
        'Key Updates': {
          rich_text: [{ text: { content: keyUpdates } }]
        },
        'Current Hurdles': {
          rich_text: [{ text: { content: currentHurdles } }]
        },
        'Action Items': {
          rich_text: [{ text: { content: actionItems } }]
        },
        'Submitted By': {
          people: [{ id: submittedByNotionId || '46ee46c2-f482-48a5-8078-95cfc93815a1' }]
        }
      }
    };
    
    console.log('📝 Request body:', JSON.stringify(requestBody, null, 2));
    
    // Retry logic for network errors
    let response;
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      try {
        attempt++;
        console.log(`🔄 Attempt ${attempt}/${maxAttempts}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        response = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log(`📡 Attempt ${attempt} response status:`, response.status);
        
        // If successful, break out of retry loop
        break;
        
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxAttempts) {
          throw error; // Re-throw on final attempt
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log('📡 Notion API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Failed to save partner update to Notion:', response.status, errorData);
      console.error('Request body was:', JSON.stringify(requestBody, null, 2));
      throw new Error(`Failed to save to database: ${response.status}`);
    }
    
    console.log('✅ Partner update saved to Notion successfully');
    
    // Send notification to admin channel
    const adminChannelId = 'C06ET1S9SNG'; // reboot_os_admin channel ID
    try {
      const healthTrend = healthScore > partnerData.currentHealthScore ? '📈' : 
                         healthScore < partnerData.currentHealthScore ? '📉' : '➡️';
      
      await slack.chat.postMessage({
        channel: adminChannelId,
        text: `Partner scorecard submitted by ${user.real_name || user.name}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🤝 Partner Update from <@${user.id}>* ${healthTrend}`
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Partner:*\n${partnerData.partnerName}`
              },
              {
                type: "mrkdwn",
                text: `*Health Score:*\n${partnerData.currentHealthScore}/10 → ${healthScore}/10`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Key Updates:*\n${keyUpdates}`
            }
          },
          ...(currentHurdles ? [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Current Hurdles:*\n${currentHurdles}`
            }
          }] : []),
          ...(actionItems ? [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Action Items:*\n${actionItems}`
            }
          }] : [])
        ]
      });
      console.log('📢 Admin channel notification sent successfully');
    } catch (adminError) {
      console.error('❌ Failed to send admin notification:', adminError);
    }
    
    // Send confirmation DM to user
    console.log('📨 Sending confirmation DM to user:', user.id);
    await slack.chat.postMessage({
      channel: user.id,
      text: `✅ Thanks for the update! Your partner health report for "${partnerData.partnerName}" has been saved.`
    });
    console.log('📨 Confirmation DM sent successfully');
    
  } catch (error) {
    console.error('Error saving partner update:', error);
    
    // Send error message to user
    await slack.chat.postMessage({
      channel: user.id,
      text: `❌ Sorry, there was an error saving your partner update for "${partnerData.partnerName}". Please try again or contact support.`
    });
  }
}

// Helper function to get Notion user ID from Slack user
async function getNotionUserIdFromSlack(slackUser) {
  try {
    // Load employee configuration
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), 'config', 'employee-config.json');
    
    if (!fs.existsSync(configPath)) {
      console.error('Employee config file not found at:', configPath);
      return null;
    }
    
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const employees = configData.employees;
    
    console.log('🔍 Looking up Slack user:', slackUser.real_name || slackUser.name);
    
    // Try to match by real name first
    const userRealName = slackUser.real_name || slackUser.name;
    let employee = employees.find(emp => emp.name === userRealName);
    
    // If not found, try by slackName if it exists
    if (!employee) {
      employee = employees.find(emp => emp.slackName === userRealName);
    }
    
    // If still not found, try partial matches
    if (!employee) {
      employee = employees.find(emp => 
        emp.name.toLowerCase().includes(userRealName.toLowerCase()) ||
        userRealName.toLowerCase().includes(emp.name.toLowerCase())
      );
    }
    
    if (employee && employee.notionUserId) {
      console.log('✅ Found employee:', employee.name, 'Notion ID:', employee.notionUserId);
      return employee.notionUserId;
    } else {
      console.warn('❌ No employee found for Slack user:', userRealName);
      return null;
    }
    
  } catch (error) {
    console.error('Error getting Notion user ID:', error);
    return null;
  }
}


