import fs from 'fs';
import path from 'path';

const CONFIG_DIR = path.join(process.cwd(), 'config');
const EMPLOYEE_CONFIG_FILE = path.join(CONFIG_DIR, 'employee-config.json');

// Default employee configuration
const DEFAULT_EMPLOYEE_CONFIG = {
  employees: [
    {
      name: 'Jimmy Buffi',
      notionUserId: '0e594686-ffd9-424b-9daa-0306638a2221',
      email: 'jbuffi@rebootmotion.com'
    },
    {
      name: 'Evan Demchick',
      notionUserId: '46ee46c2-f482-48a5-8078-95cfc93815a1',
      email: 'edemchick@rebootmotion.com'
    },
    {
      name: 'Robert Calise',
      notionUserId: '6c9ff824-2dd2-4e19-b5b8-6051d56966fe',
      email: 'rcalise@rebootmotion.com'
    },
    {
      name: 'Creagor Elsom',
      notionUserId: '33227521-8428-4238-94e0-53401caa529b',
      email: 'celsom@rebootmotion.com'
    },
    {
      name: 'Jacob Howenstein',
      notionUserId: '9b1d8a2c-2dfe-4fe7-a9a4-9fb330396bd3',
      email: 'jhowenstein@rebootmotion.com'
    }
  ]
};

// Helper function to read employee config
const readEmployeeConfig = () => {
  try {
    if (fs.existsSync(EMPLOYEE_CONFIG_FILE)) {
      const data = fs.readFileSync(EMPLOYEE_CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading employee config:', error);
  }
  return DEFAULT_EMPLOYEE_CONFIG;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = readEmployeeConfig();
    res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching employee config:', error);
    res.status(500).json({ error: 'Failed to fetch employee list' });
  }
}