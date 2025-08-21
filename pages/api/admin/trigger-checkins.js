import { getCurrentSchedule } from './schedule';
import { getAdminConfig } from './admin-config';

// Helper to get partner schedule settings
const getPartnerSchedule = async () => {
  try {
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    
    const defaultPartnerSchedule = { enabled: false, day: 'Friday' };
    const databaseId = process.env.NOTION_PARTNER_SETTINGS_DATABASE_ID;
    
    if (!databaseId) {
      console.log('No partner settings database ID found, using defaults');
      return defaultPartnerSchedule;
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 1
    });

    if (response.results.length === 0) {
      console.log('No partner settings found in database, using defaults');
      return defaultPartnerSchedule;
    }

    const page = response.results[0];
    const properties = page.properties;

    const settings = {
      enabled: properties.enabled?.checkbox ?? defaultPartnerSchedule.enabled,
      day: properties.day?.select?.name ?? defaultPartnerSchedule.day
    };

    console.log('Partner schedule settings loaded:', settings);
    return settings;
  } catch (error) {
    console.error('Error reading partner schedule settings:', error);
    return { enabled: false, day: 'Friday' };
  }
};

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
    const goalSchedule = await getCurrentSchedule();
    const partnerSchedule = await getPartnerSchedule();
    
    console.log('Schedule check:', { 
      goal: goalSchedule, 
      partner: partnerSchedule 
    });

    // Get current time in Eastern timezone (hardcoded to 10am Eastern)
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    const currentDay = easternTime.toLocaleDateString('en-US', { weekday: 'long' });
    const currentHour = easternTime.getHours();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${easternTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Check if it's the right day and around 10am Eastern (handle DST/Standard Time)
    const isScheduledTime = currentHour >= 9 && currentHour <= 11; // 9-11 AM Eastern to handle timezone changes
    
    // Check both schedules
    const shouldSendGoals = goalSchedule.enabled && currentDay === goalSchedule.day && isScheduledTime;
    const shouldSendPartners = partnerSchedule.enabled && currentDay === partnerSchedule.day && isScheduledTime;
    
    if (!shouldSendGoals && !shouldSendPartners) {
      return res.status(200).json({
        message: `No check-ins scheduled. Current: ${currentDay} ${currentTime}`,
        sent: false,
        currentDay,
        currentTime,
        isScheduledTime,
        goalSchedule: {
          ...goalSchedule,
          isRightDay: currentDay === goalSchedule.day,
          shouldSend: shouldSendGoals
        },
        partnerSchedule: {
          ...partnerSchedule,
          isRightDay: currentDay === partnerSchedule.day,
          shouldSend: shouldSendPartners
        }
      });
    }

    console.log('Triggering scheduled check-ins:', {
      day: currentDay,
      time: currentTime,
      shouldSendGoals,
      shouldSendPartners
    });

    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
    const results = {};

    // Send goal check-ins if scheduled
    if (shouldSendGoals) {
      try {
        console.log('Sending goal check-ins...');
        const goalResponse = await fetch(`${baseUrl}/api/slack/send-checkins`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'vercel-cron-internal',
          },
        });

        if (goalResponse.ok) {
          results.goals = await goalResponse.json();
          console.log('Goal check-ins sent successfully:', results.goals);
        } else {
          const errorText = await goalResponse.text();
          results.goals = { error: `Goal check-ins failed: ${goalResponse.status} - ${errorText}` };
          console.error('Goal check-ins failed:', results.goals.error);
        }
      } catch (error) {
        results.goals = { error: `Goal check-ins error: ${error.message}` };
        console.error('Goal check-ins error:', error);
      }
    }

    // Send partner check-ins if scheduled
    if (shouldSendPartners) {
      try {
        console.log('Fetching partners and sending check-ins...');
        
        // First, fetch all active partners
        const partnersResponse = await fetch(`${baseUrl}/api/partners`, {
          method: 'GET',
          headers: {
            'User-Agent': 'vercel-cron-internal',
          },
        });

        if (partnersResponse.ok) {
          const partners = await partnersResponse.json();
          console.log(`Found ${partners.length} partners to process`);

          // Send check-in to each partner's main contact
          const partnerResults = [];
          for (const partner of partners) {
            try {
              const partnerResponse = await fetch(`${baseUrl}/api/slack/send-partner-checkin`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'vercel-cron-internal',
                },
                body: JSON.stringify({
                  partner: partner,
                  triggeredBy: 'Automated Weekly Check-in'
                })
              });

              const partnerResult = await partnerResponse.json();
              partnerResults.push({
                partner: partner.partnerName,
                success: partnerResponse.ok,
                result: partnerResult
              });

              if (partnerResponse.ok) {
                console.log(`Partner check-in sent for ${partner.partnerName}`);
              } else {
                console.error(`Partner check-in failed for ${partner.partnerName}:`, partnerResult);
              }
            } catch (error) {
              console.error(`Error sending partner check-in for ${partner.partnerName}:`, error);
              partnerResults.push({
                partner: partner.partnerName,
                success: false,
                result: { error: error.message }
              });
            }
          }

          results.partners = {
            total: partners.length,
            sent: partnerResults.filter(r => r.success).length,
            skipped: partnerResults.filter(r => r.result.skipped).length,
            failed: partnerResults.filter(r => !r.success && !r.result.skipped).length,
            details: partnerResults
          };
          console.log('Partner check-ins completed:', results.partners);
        } else {
          const errorText = await partnersResponse.text();
          results.partners = { error: `Failed to fetch partners: ${partnersResponse.status} - ${errorText}` };
          console.error('Failed to fetch partners:', results.partners.error);
        }
      } catch (error) {
        results.partners = { error: `Partner check-ins error: ${error.message}` };
        console.error('Partner check-ins error:', error);
      }
    }

    return res.status(200).json({
      message: 'Check-ins process completed',
      sent: true,
      currentDay,
      currentTime,
      scheduledTime: '9-11 AM Eastern (handles DST)',
      goalSchedule: { ...goalSchedule, sent: shouldSendGoals },
      partnerSchedule: { ...partnerSchedule, sent: shouldSendPartners },
      results
    });

  } catch (error) {
    console.error('Error triggering scheduled check-ins:', error);
    return res.status(500).json({ 
      error: 'Failed to trigger scheduled check-ins',
      details: error.message 
    });
  }
}