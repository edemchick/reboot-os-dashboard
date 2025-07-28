import { getAllUpdates } from '../../lib/progress-store';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const updates = getAllUpdates();
      console.log('Loaded progress updates:', Object.keys(updates).length, 'updates');
      res.status(200).json({ updates });
      
    } catch (error) {
      console.error('Error in progress-updates API:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}