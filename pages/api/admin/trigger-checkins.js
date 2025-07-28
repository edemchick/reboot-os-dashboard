import { getCurrentSchedule } from './schedule';

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
    const schedule = getCurrentSchedule();
    
    if (!schedule.enabled) {
      return res.status(200).json({ 
        message: 'Scheduled check-ins are disabled',
        sent: false 
      });
    }

    // Get current time in Eastern timezone
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    const currentDay = easternTime.toLocaleDateString('en-US', { weekday: 'long' });
    const currentHour = easternTime.getHours();
    const currentMinute = easternTime.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    // Parse scheduled time
    const [scheduledHour, scheduledMinute] = schedule.time.split(':').map(Number);
    
    // Check if it's the right day and within the right hour
    const isRightDay = currentDay === schedule.day;
    const isRightHour = currentHour === scheduledHour;
    
    if (isRightDay && isRightHour) {
      console.log('Triggering scheduled check-ins:', {
        day: currentDay,
        time: currentTime,
        scheduled: `${schedule.day} at ${schedule.time}`
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
          scheduledTime: schedule.time,
          currentTime: currentTime,
          slackResponse: result
        });
      } else {
        const errorText = await response.text();
        throw new Error(`Slack API failed: ${response.status} - ${errorText}`);
      }
    } else {
      return res.status(200).json({ 
        message: `Not the right time. Current: ${currentDay} ${currentTime}, Scheduled: ${schedule.day} ${schedule.time}`,
        sent: false,
        scheduledDay: schedule.day,
        scheduledTime: schedule.time,
        currentDay: currentDay,
        currentTime: currentTime,
        isRightDay,
        isRightHour
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