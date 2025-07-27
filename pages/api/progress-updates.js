export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const fs = require('fs');
      const updatesFile = '/tmp/progress-updates.json';
      
      let updates = {};
      
      // Read updates from file
      try {
        if (fs.existsSync(updatesFile)) {
          updates = JSON.parse(fs.readFileSync(updatesFile, 'utf8'));
          console.log('Loaded progress updates:', Object.keys(updates).length, 'updates');
        } else {
          console.log('No progress updates file found');
        }
      } catch (error) {
        console.error('Error reading progress updates:', error);
      }
      
      res.status(200).json({ updates });
      
    } catch (error) {
      console.error('Error in progress-updates API:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}