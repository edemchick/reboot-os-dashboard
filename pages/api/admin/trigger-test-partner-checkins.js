import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getAdminConfig } from './admin-config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get admin config to check permissions and get test user
    const adminConfig = getAdminConfig();
    if (!adminConfig.adminEmails.includes(session.user.email)) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    if (!adminConfig.testUser) {
      return res.status(400).json({ error: 'No test user configured. Please set a test user in Admin Configuration.' });
    }

    console.log('Test partner check-ins requested by:', session.user.email);
    console.log('Test user configured:', adminConfig.testUser);

    // Fetch active partners from Notion
    const partnersResponse = await fetch(`${req.headers.origin}/api/partners`);
    if (!partnersResponse.ok) {
      throw new Error('Failed to fetch partners');
    }
    const partners = await partnersResponse.json();

    if (partners.length === 0) {
      return res.status(200).json({ message: 'No active partners found, no test check-ins sent' });
    }

    console.log(`Sending test check-ins for ${partners.length} partners to test user`);

    // Send test check-ins to the configured test user instead of partner owners
    const slackPromises = partners.map(async (partner) => {
      try {
        // Send test DM for this partner to the test user
        const slackResponse = await fetch(`${req.headers.origin}/api/slack/send-test-partner-checkin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partner: partner,
            testUser: adminConfig.testUser,
            triggeredBy: session.user.email
          })
        });

        if (!slackResponse.ok) {
          const errorData = await slackResponse.json();
          console.error(`Failed to send test check-in for ${partner.partnerName}:`, errorData);
          return { success: false, partner: partner.partnerName, error: errorData.error };
        }

        const responseData = await slackResponse.json();
        if (responseData.skipped) {
          console.log(`Skipped test check-in for ${partner.partnerName}: ${responseData.message}`);
          return { success: true, partner: partner.partnerName, skipped: true };
        }

        return { success: true, partner: partner.partnerName };
      } catch (error) {
        console.error(`Error sending test check-in for ${partner.partnerName}:`, error);
        return { success: false, partner: partner.partnerName, error: error.message };
      }
    });

    // Wait for all test Slack messages to be sent
    const results = await Promise.all(slackPromises);
    
    // Count successes and failures
    const successful = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.success && r.skipped).length;
    const failed = results.filter(r => !r.success);

    if (failed.length > 0) {
      console.error('Some test partner check-ins failed:', failed);
      return res.status(207).json({ 
        message: `Sent ${successful} test partner check-ins successfully to ${adminConfig.testUser}, ${skipped} skipped, ${failed.length} failed`,
        sentCount: successful,
        successful,
        skipped,
        failed: failed.length,
        failures: failed,
        testUser: adminConfig.testUser
      });
    }

    return res.status(200).json({ 
      message: `Successfully sent ${successful} test partner check-ins to ${adminConfig.testUser}`,
      sentCount: successful,
      successful,
      skipped,
      testUser: adminConfig.testUser,
      partners: results.map(r => r.partner)
    });

  } catch (error) {
    console.error('Error triggering test partner check-ins:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}