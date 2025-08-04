import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin (same logic as other admin endpoints)
    const adminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
    if (!adminEmails.includes(session.user.email)) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    // Fetch active partners from Notion
    const partnersResponse = await fetch(`${req.headers.origin}/api/partners`);
    if (!partnersResponse.ok) {
      throw new Error('Failed to fetch partners');
    }
    const partners = await partnersResponse.json();

    if (partners.length === 0) {
      return res.status(200).json({ message: 'No active partners found, no check-ins sent' });
    }

    // Send a Slack DM for each partner
    const slackPromises = partners.map(async (partner) => {
      try {
        // Send individual DM for this partner
        const slackResponse = await fetch(`${req.headers.origin}/api/slack/send-partner-checkin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partner: partner,
            triggeredBy: session.user.email
          })
        });

        if (!slackResponse.ok) {
          const errorData = await slackResponse.json();
          console.error(`Failed to send check-in for ${partner.partnerName}:`, errorData);
          return { success: false, partner: partner.partnerName, error: errorData.error };
        }

        const responseData = await slackResponse.json();
        if (responseData.skipped) {
          console.log(`Skipped ${partner.partnerName}: ${responseData.message}`);
          return { success: true, partner: partner.partnerName, skipped: true };
        }

        return { success: true, partner: partner.partnerName };
      } catch (error) {
        console.error(`Error sending check-in for ${partner.partnerName}:`, error);
        return { success: false, partner: partner.partnerName, error: error.message };
      }
    });

    // Wait for all Slack messages to be sent
    const results = await Promise.all(slackPromises);
    
    // Count successes and failures
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);

    if (failed.length > 0) {
      console.error('Some partner check-ins failed:', failed);
      return res.status(207).json({ 
        message: `Sent ${successful} partner check-ins successfully, ${failed.length} failed`,
        successful,
        failed: failed.length,
        failures: failed
      });
    }

    return res.status(200).json({ 
      message: `Successfully sent ${successful} partner check-ins`,
      successful,
      partners: results.map(r => r.partner)
    });

  } catch (error) {
    console.error('Error triggering partner check-ins:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}