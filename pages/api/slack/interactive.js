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
        console.log('Confirming submission for goal:', data.goalData.goalTitle);
        
        // Call the submission logic directly with the data we have
        await handleDirectGoalSubmission(slack, payload.user, data.goalData, data.submittedKRs, channelId);
        console.log('Final goal submission processed');
      } else if (action.action_id === 'grade_before_submit') {
        const data = JSON.parse(action.value);
        console.log('Grading before submit for goal:', data.goalData.goalTitle);
        
        // Grade the KRs and show feedback, then allow editing or submitting
        await handleGradeBeforeSubmit(slack, payload, data);
        console.log('Grade before submit processed');
      }
    } else if (payload.type === 'view_submission') {
      // Handle modal submission
      console.log('Handling view submission...');
      console.log('Modal callback_id:', payload.view.callback_id);
      
      try {
        if (payload.view.callback_id === 'goal_approval') {
          // Open confirmation modal instead of immediately processing
          const goalData = JSON.parse(payload.view.private_metadata);
          const values = payload.view.state.values;
          
          // Extract the KRs they submitted
          const submittedKRs = [];
          for (let i = 1; i <= 5; i++) {
            const krValue = values[`kr_${i}`]?.[`kr_${i}_input`]?.value?.trim();
            if (krValue) {
              submittedKRs.push(krValue);
            }
          }
          
          // Open confirmation modal with grade option
          const confirmationModal = createSubmissionConfirmationModal(goalData, submittedKRs);
          
          // Update the current modal to the confirmation modal
          await slack.views.update({
            view_id: payload.view.id,
            view: confirmationModal
          });
          
          console.log('Opened confirmation modal with grade option');
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
          text: `🎯 *${goalData.goalTitle}*`
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
          text: "Key Result 1 *",
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
          text: "Key Result 2 *",
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
  
  console.log('Final goal submission received for:', goalData.goalTitle);
  console.log('Submitted by:', user.real_name || user.name);
  
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
    text: `✅ Your goal approval request for "${goalData.goalTitle}" has been submitted! Your Key Results have been posted to the team channel for review.`
  });
  
  console.log('Goal approval submission handled successfully');
}

async function handleDirectGoalSubmission(slack, user, goalData, submittedKRs, channelId) {
  console.log('Direct goal submission for:', goalData.goalTitle);
  console.log('Submitted by:', user.real_name || user.name);
  
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
    text: `✅ Your goal approval request for "${goalData.goalTitle}" has been submitted! Your Key Results have been posted to the team channel for review.`
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
    
    console.log('Grading KRs before submit:', keyResults);
    
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
    
    console.log(`Grading ${keyResults.length} key results for goal: ${goalData.goalTitle}`);
    
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
        text: `🎯 *${goalData.goalTitle}*`
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


