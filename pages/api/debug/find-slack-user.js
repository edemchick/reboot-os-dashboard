import { WebClient } from '@slack/web-api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  
  if (!slackToken) {
    return res.status(500).json({ error: 'Slack bot token not configured' });
  }

  try {
    const slack = new WebClient(slackToken);
    const result = await slack.users.list();
    
    const users = result.members
      .filter(member => !member.is_bot && !member.deleted)
      .map(member => ({
        id: member.id,
        name: member.real_name || member.name,
        email: member.profile?.email || 'No email',
        username: member.name
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching Slack users:', error);
    res.status(500).json({ error: error.message });
  }
}