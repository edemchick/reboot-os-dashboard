import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getCurrentSchedule } from './schedule';

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

    const schedule = getCurrentSchedule();
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    const currentDay = easternTime.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = easternTime.toTimeString().slice(0, 5);
    const currentDate = easternTime.toLocaleDateString('en-US');

    return res.status(200).json({
      schedule,
      currentStatus: {
        currentDay,
        currentTime,
        currentDate,
        timeZone: 'America/New_York (Eastern)',
        isScheduledDay: currentDay === schedule.day,
        nextScheduledDate: getNextScheduledDate(schedule.day, '10:00')
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
function getNextScheduledDate(scheduledDay, scheduledTime) {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = daysOfWeek.indexOf(scheduledDay);
  const currentDayIndex = easternTime.getDay();
  
  let daysUntilTarget = targetDayIndex - currentDayIndex;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // Next week
  }
  
  const nextDate = new Date(easternTime);
  nextDate.setDate(nextDate.getDate() + daysUntilTarget);
  
  const [hours, minutes] = scheduledTime.split(':');
  nextDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  return nextDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });
}