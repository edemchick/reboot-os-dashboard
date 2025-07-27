export default async function handler(req, res) {
  console.log('=== Slack Test Endpoint Called ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  res.status(200).json({ 
    success: true, 
    method: req.method,
    timestamp: new Date().toISOString()
  });
}