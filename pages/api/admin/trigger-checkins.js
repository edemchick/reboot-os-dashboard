import { getCurrentSchedule } from './schedule';

// This endpoint will be called by a cron job or external scheduler
// For production, you would set up a Vercel Cron job to call this endpoint
export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    // Check if it's the right time to send check-ins
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    const currentDay = easternTime.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = easternTime.toTimeString().slice(0, 5); // HH:MM format
    
    // For now, we'll just check if it's the right day
    // In production, you'd want more sophisticated time checking
    if (currentDay === schedule.day) {
      // Trigger the check-ins by calling the existing endpoint
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/slack/send-checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Include some authentication or API key for security
      });

      if (response.ok) {
        return res.status(200).json({ 
          message: 'Weekly check-ins sent successfully',
          sent: true,
          scheduledDay: schedule.day,
          scheduledTime: schedule.time,
          currentTime: currentTime
        });
      } else {
        throw new Error('Failed to send check-ins');
      }
    } else {
      return res.status(200).json({ 
        message: `Not scheduled day. Current: ${currentDay}, Scheduled: ${schedule.day}`,
        sent: false,
        scheduledDay: schedule.day,
        currentDay: currentDay
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