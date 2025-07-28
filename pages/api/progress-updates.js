import { getAllUpdates } from '../../lib/progress-store';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      console.log('=== Progress Updates API Called ===');
      const updates = getAllUpdates();
      console.log('Retrieved updates:', JSON.stringify(updates, null, 2));
      console.log('Update count:', Object.keys(updates).length);
      
      res.status(200).json({ updates });
      
    } catch (error) {
      console.error('Error in progress-updates API:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}