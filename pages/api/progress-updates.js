// Simple in-memory storage for progress updates
// In production, you'd want to use a proper database
let progressUpdates = {};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Store a progress update
    const { goalId, progress, updatedAt } = req.body;
    
    if (!goalId || progress === undefined) {
      return res.status(400).json({ error: 'Goal ID and progress are required' });
    }

    progressUpdates[goalId] = {
      progress,
      updatedAt
    };

    console.log('Stored progress update:', { goalId, progress, updatedAt });
    res.status(200).json({ success: true });

  } else if (req.method === 'GET') {
    // Retrieve all progress updates
    res.status(200).json({ updates: progressUpdates });

  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}