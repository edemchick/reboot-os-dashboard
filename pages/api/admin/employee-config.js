import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const CONFIG_DIR = path.join(process.cwd(), 'config');
const EMPLOYEE_CONFIG_FILE = path.join(CONFIG_DIR, 'employee-config.json');

// Default employee configuration with Notion User IDs
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
      slackName: 'Bob Calise',
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

// Helper function to check if user is admin
const isAdmin = (email) => {
  const fallbackAdminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
  
  try {
    if (fs.existsSync(path.join(CONFIG_DIR, 'admin-config.json'))) {
      const adminConfig = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'admin-config.json'), 'utf8'));
      if (adminConfig.adminEmails && Array.isArray(adminConfig.adminEmails)) {
        return adminConfig.adminEmails.includes(email);
      }
    }
  } catch (error) {
    console.error('Error reading admin config:', error);
  }
  
  return fallbackAdminEmails.includes(email);
};

// Helper function to ensure config directory exists
const ensureConfigDir = () => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
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

// Helper function to write employee config
const writeEmployeeConfig = (config) => {
  ensureConfigDir();
  fs.writeFileSync(EMPLOYEE_CONFIG_FILE, JSON.stringify(config, null, 2));
};

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isAdmin(session.user.email)) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  if (req.method === 'GET') {
    try {
      const config = readEmployeeConfig();
      res.status(200).json(config);
    } catch (error) {
      console.error('Error fetching employee config:', error);
      res.status(500).json({ error: 'Failed to fetch employee configuration' });
    }
  } else if (req.method === 'POST') {
    try {
      const { employees } = req.body;

      if (!employees || !Array.isArray(employees)) {
        return res.status(400).json({ error: 'Invalid employee configuration' });
      }

      // Validate each employee entry
      for (const employee of employees) {
        if (!employee.name || !employee.notionUserId) {
          return res.status(400).json({ error: 'Each employee must have a name and notionUserId' });
        }
      }

      const config = { employees };
      writeEmployeeConfig(config);
      
      res.status(200).json({ success: true, message: 'Employee configuration saved successfully' });
    } catch (error) {
      console.error('Error saving employee config:', error);
      res.status(500).json({ error: 'Failed to save employee configuration' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}