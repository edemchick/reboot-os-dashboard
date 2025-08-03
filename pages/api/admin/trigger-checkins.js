import { getCurrentSchedule } from './schedule';
import { getAdminConfig } from './admin-config';

// This endpoint is called by Vercel Cron jobs
export default async function handler(req, res) {
  // Security: Only allow Vercel Cron jobs or specific user agents
  const userAgent = req.headers['user-agent'];
  const isVercelCron = userAgent && userAgent.includes('vercel-cron');
  const isCronJob = req.headers['x-vercel-cron'] || isVercelCron;
  
  if (!isCronJob && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const schedule = await getCurrentSchedule();
    
    if (!schedule.enabled) {
      return res.status(200).json({ 
        message: 'Scheduled check-ins are disabled',
        sent: false,
        schedule: schedule
      });
    }

    // Get current time in the configured timezone
    const now = new Date();
    const localTime = new Date(now.toLocaleString("en-US", {timeZone: schedule.timezone}));
    
    const currentDay = localTime.toLocaleDateString('en-US', { weekday: 'long' });
    const currentHour = localTime.getHours();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${localTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Check if it's the right day and configured time
    const isRightDay = currentDay === schedule.day;
    const isScheduledTime = currentHour === schedule.hour;
    
    if (isRightDay && isScheduledTime) {
      console.log('Triggering scheduled check-ins:', {
        day: currentDay,
        time: currentTime,
        scheduled: `${schedule.day} at ${schedule.hour}:00 ${schedule.timezone.split('/')[1]?.replace('_', ' ')}`
      });

      // Make internal request to send check-ins
      const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
      const response = await fetch(`${baseUrl}/api/slack/send-checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'vercel-cron-internal',
        },
      });

      if (response.ok) {
        const result = await response.json();
        return res.status(200).json({ 
          message: 'Weekly check-ins sent successfully',
          sent: true,
          scheduledDay: schedule.day,
          scheduledTime: `${schedule.hour}:00 ${schedule.timezone.split('/')[1]?.replace('_', ' ')}`,
          currentTime: currentTime,
          slackResponse: result
        });
      } else {
        const errorText = await response.text();
        throw new Error(`Slack API failed: ${response.status} - ${errorText}`);
      }
    } else {
      return res.status(200).json({ 
        message: `Not the right time. Current: ${currentDay} ${currentTime}, Scheduled: ${schedule.day} ${schedule.hour}:00 ${schedule.timezone.split('/')[1]?.replace('_', ' ')}`,
        sent: false,
        scheduledDay: schedule.day,
        scheduledTime: `${schedule.hour}:00 ${schedule.timezone.split('/')[1]?.replace('_', ' ')}`,
        currentDay: currentDay,
        currentTime: currentTime,
        isRightDay,
        isScheduledTime,
        schedule: schedule
      });
    }

  } catch (error) {
    console.error('Error triggering scheduled check-ins:', error);
    return res.status(500).json({ 
      error: 'Failed to trigger scheduled check-ins',
      details: error.message 
    });
  }
}