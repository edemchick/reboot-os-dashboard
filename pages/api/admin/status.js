import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getCurrentSchedule } from './schedule';
import { getAdminConfig } from './admin-config';

// Check if current user is admin
const isAdmin = (email) => {
  const adminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
  return adminEmails.includes(email);
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check admin access
    if (!isAdmin(session.user.email)) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const schedule = await getCurrentSchedule();
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    const currentDay = easternTime.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = easternTime.toTimeString().slice(0, 5);
    const currentDate = easternTime.toLocaleDateString('en-US');

    const configuredTime = '10:00';

    return res.status(200).json({
      schedule,
      currentStatus: {
        currentDay,
        currentTime,
        currentDate,
        timeZone: 'Eastern Time',
        isScheduledDay: currentDay === schedule.day,
        nextScheduledDate: getNextScheduledDate(schedule.day, configuredTime, 'America/New_York')
      },
      systemInfo: {
        serverTime: now.toISOString(),
        easternTime: easternTime.toISOString()
      }
    });

  } catch (error) {
    console.error('Admin status API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to calculate next scheduled date
function getNextScheduledDate(scheduledDay, scheduledTime, timezone = 'America/New_York') {
  const now = new Date();
  
  // Get current day of week in the configured timezone
  const currentDayInTimezone = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long'
  }).format(now);
  
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = daysOfWeek.indexOf(scheduledDay);
  const currentDayIndex = daysOfWeek.indexOf(currentDayInTimezone);
  
  let daysUntilTarget = targetDayIndex - currentDayIndex;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // Next week
  }
  
  // Calculate the target date
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntilTarget);
  
  // Format the date part
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const datePart = dateFormatter.format(targetDate);
  
  // Parse the time and format it
  const [hours, minutes] = scheduledTime.split(':');
  const hour12 = parseInt(hours) > 12 ? parseInt(hours) - 12 : (parseInt(hours) === 0 ? 12 : parseInt(hours));
  const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
  const timeStr = `${hour12}:${minutes.padStart(2, '0')} ${ampm}`;
  
  return `${datePart} at ${timeStr}`;
}