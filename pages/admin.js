import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { ArrowLeft, Clock, Save, AlertCircle, MessageSquare, Settings, Plus, X } from 'lucide-react';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scheduleData, setScheduleData] = useState({
    enabled: false,
    day: 'Monday',
    hour: 10,
    timezone: 'America/New_York'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [statusData, setStatusData] = useState(null);
  const [slackLoading, setSlackLoading] = useState(false);
  const [quarterlyConfig, setQuarterlyConfig] = useState(null);
  const [quarterlyLoading, setQuarterlyLoading] = useState(false);
  const [adminConfig, setAdminConfig] = useState(null);
  const [adminConfigLoading, setAdminConfigLoading] = useState(false);
  const [employeeConfig, setEmployeeConfig] = useState(null);
  const [employeeConfigLoading, setEmployeeConfigLoading] = useState(false);

  // Check if current user is admin
  const isAdmin = async () => {
    if (!session?.user?.email) return false;
    
    try {
      const response = await fetch('/api/admin/admin-config');
      if (response.ok) {
        const config = await response.json();
        return config.adminEmails.includes(session.user.email);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
    
    // Fallback to hardcoded list if config fails
    const fallbackAdminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
    return fallbackAdminEmails.includes(session.user.email);
  };

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      if (status === 'loading') return;
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      const adminStatus = await isAdmin();
      if (!adminStatus) {
        router.push('/');
        return;
      }

      fetchScheduleSettings();
      fetchStatusData();
      fetchQuarterlyConfig();
      fetchAdminConfig();
      fetchEmployeeConfig();
    };

    checkAdminAndFetch();
  }, [session, status, router]);

  const fetchScheduleSettings = async () => {
    try {
      const response = await fetch('/api/admin/schedule');
      if (response.ok) {
        const data = await response.json();
        setScheduleData(data);
      }
    } catch (error) {
      console.error('Error fetching schedule settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusData = async () => {
    try {
      const response = await fetch('/api/admin/status');
      if (response.ok) {
        const data = await response.json();
        setStatusData(data);
      }
    } catch (error) {
      console.error('Error fetching status data:', error);
    }
  };

  const fetchQuarterlyConfig = async () => {
    try {
      const response = await fetch('/api/admin/quarterly-config');
      if (response.ok) {
        const data = await response.json();
        setQuarterlyConfig(data);
      }
    } catch (error) {
      console.error('Error fetching quarterly config:', error);
    }
  };

  const saveQuarterlyConfig = async () => {
    setQuarterlyLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch('/api/admin/quarterly-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quarterlyConfig),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Quarterly configuration saved successfully!' });
      } else {
        throw new Error('Failed to save quarterly configuration');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save quarterly configuration. Please try again.' });
      console.error('Error saving quarterly config:', error);
    } finally {
      setQuarterlyLoading(false);
    }
  };

  const updateQuarterDate = (quarter, field, type, value) => {
    setQuarterlyConfig(prev => ({
      ...prev,
      quarters: {
        ...prev.quarters,
        [quarter]: {
          ...prev.quarters[quarter],
          [field]: {
            ...prev.quarters[quarter][field],
            [type]: parseInt(value)
          }
        }
      }
    }));
  };

  const fetchAdminConfig = async () => {
    try {
      const response = await fetch('/api/admin/admin-config');
      if (response.ok) {
        const data = await response.json();
        setAdminConfig(data);
      }
    } catch (error) {
      console.error('Error fetching admin config:', error);
    }
  };

  const fetchEmployeeConfig = async () => {
    try {
      setEmployeeConfigLoading(true);
      const response = await fetch('/api/admin/employee-config');
      if (response.ok) {
        const data = await response.json();
        setEmployeeConfig(data);
      }
    } catch (error) {
      console.error('Error fetching employee config:', error);
    } finally {
      setEmployeeConfigLoading(false);
    }
  };

  const saveAdminConfig = async () => {
    setAdminConfigLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch('/api/admin/admin-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminConfig),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Admin configuration saved successfully!' });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save admin configuration');
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to save admin configuration: ${error.message}` });
      console.error('Error saving admin config:', error);
    } finally {
      setAdminConfigLoading(false);
    }
  };

  const addAdminEmail = () => {
    setAdminConfig(prev => ({
      ...prev,
      adminEmails: [...prev.adminEmails, '']
    }));
  };

  const removeAdminEmail = (index) => {
    setAdminConfig(prev => ({
      ...prev,
      adminEmails: prev.adminEmails.filter((_, i) => i !== index)
    }));
  };

  const updateAdminEmail = (index, value) => {
    setAdminConfig(prev => ({
      ...prev,
      adminEmails: prev.adminEmails.map((email, i) => i === index ? value : email)
    }));
  };

  // Employee management functions
  const saveEmployeeConfig = async () => {
    setEmployeeConfigLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/admin/employee-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(employeeConfig),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Employee configuration saved successfully!' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Failed to save employee configuration' });
      }
    } catch (error) {
      console.error('Error saving employee config:', error);
      setMessage({ type: 'error', text: 'Failed to save employee configuration' });
    } finally {
      setEmployeeConfigLoading(false);
    }
  };

  const addEmployee = () => {
    setEmployeeConfig(prev => ({
      ...prev,
      employees: [...prev.employees, { name: '', notionUserId: '', email: '' }]
    }));
  };

  const removeEmployee = (index) => {
    setEmployeeConfig(prev => ({
      ...prev,
      employees: prev.employees.filter((_, i) => i !== index)
    }));
  };

  const updateEmployee = (index, field, value) => {
    setEmployeeConfig(prev => ({
      ...prev,
      employees: prev.employees.map((employee, i) => 
        i === index ? { ...employee, [field]: value } : employee
      )
    }));
  };

  const saveScheduleSettings = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch('/api/admin/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Schedule settings saved successfully!' });
        // Refresh status data
        fetchStatusData();
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save schedule settings. Please try again.' });
      console.error('Error saving schedule settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setScheduleData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const sendManualCheckins = async () => {
    setSlackLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch('/api/slack/send-checkins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send check-ins');
      }
      
      setMessage({ 
        type: 'success', 
        text: `Successfully sent check-ins to ${data.sentCount} goal owners!` 
      });
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: `Error sending check-ins: ${err.message}` 
      });
      console.error('Error:', err);
    } finally {
      setSlackLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Dashboard
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="text-xl font-semibold text-gray-900">Admin Settings</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Weekly Check-in Schedule</h2>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Configure automated Slack check-ins with flexible scheduling
            </p>
          </div>
          
          <div className="p-6 space-y-6">
            {message.text && (
              <div className={`p-4 rounded-md flex items-center gap-2 ${
                message.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <AlertCircle className="h-4 w-4" />
                {message.text}
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={scheduleData.enabled}
                onChange={(e) => handleInputChange('enabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                Enable automatic weekly check-ins
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Day of Week
                </label>
                <select
                  value={scheduleData.day}
                  onChange={(e) => handleInputChange('day', e.target.value)}
                  disabled={!scheduleData.enabled}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    !scheduleData.enabled ? 'bg-gray-100 text-gray-400' : ''
                  }`}
                >
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time (Hour)
                </label>
                <select
                  value={scheduleData.hour}
                  onChange={(e) => handleInputChange('hour', parseInt(e.target.value))}
                  disabled={!scheduleData.enabled}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    !scheduleData.enabled ? 'bg-gray-100 text-gray-400' : ''
                  }`}
                >
                  {Array.from({length: 24}, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12:00 AM' : 
                       i < 12 ? `${i}:00 AM` : 
                       i === 12 ? '12:00 PM' : 
                       `${i - 12}:00 PM`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={scheduleData.timezone}
                  onChange={(e) => handleInputChange('timezone', e.target.value)}
                  disabled={!scheduleData.enabled}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    !scheduleData.enabled ? 'bg-gray-100 text-gray-400' : ''
                  }`}
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>

            {scheduleData.enabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Scheduled:</strong> {scheduleData.day}s at {
                    scheduleData.hour === 0 ? '12:00 AM' : 
                    scheduleData.hour < 12 ? `${scheduleData.hour}:00 AM` : 
                    scheduleData.hour === 12 ? '12:00 PM' : 
                    `${scheduleData.hour - 12}:00 PM`
                  } {scheduleData.timezone.split('/')[1]?.replace('_', ' ')} Time
                </p>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex gap-3">
                <button
                  onClick={saveScheduleSettings}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                
                <button
                  onClick={sendManualCheckins}
                  disabled={slackLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  {slackLoading ? 'Sending...' : 'Send Manual Check-In'}
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Important Notes</h4>
                  <ul className="mt-1 text-sm text-yellow-700 space-y-1">
                    <li>• Settings are saved to your browser session temporarily</li>
                    <li>• For persistence across deployments, update environment variables in Vercel</li>
                    <li>• Check-ins will be sent to all goal owners at the scheduled time</li>
                    <li>• The manual "Send Manual Check-In" button works regardless of this setting</li>
                    <li>• The system checks every hour whether it's time to send check-ins</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {statusData && (
          <div className="bg-white rounded-lg shadow-sm border mt-6">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Current Status</h2>
              <p className="mt-1 text-sm text-gray-600">
                Real-time information about the scheduled check-ins
              </p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Current Time ({statusData.currentStatus.timeZone}):</span>
                    <div className="text-lg text-gray-900">{statusData.currentStatus.currentTime} on {statusData.currentStatus.currentDay}</div>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-500">Schedule Status:</span>
                    <div className={`text-lg font-medium ${
                      statusData.schedule.enabled 
                        ? 'text-green-600' 
                        : 'text-gray-500'
                    }`}>
                      {statusData.schedule.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Next Scheduled:</span>
                    <div className="text-lg text-gray-900">{statusData.currentStatus.nextScheduledDate}</div>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-500">Is Today Scheduled Day:</span>
                    <div className={`text-lg font-medium ${
                      statusData.currentStatus.isScheduledDay 
                        ? 'text-green-600' 
                        : 'text-gray-500'
                    }`}>
                      {statusData.currentStatus.isScheduledDay ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {quarterlyConfig && (
          <div className="bg-white rounded-lg shadow-sm border mt-6">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Quarterly Date Configuration</h2>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Configure the start and end dates for each quarter
              </p>
            </div>
            
            <div className="p-6 space-y-6">
              {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => (
                <div key={quarter} className="border rounded-lg p-4">
                  <h3 className="text-md font-medium text-gray-900 mb-4">{quarter}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={quarterlyConfig.quarters[quarter].start.month}
                          onChange={(e) => updateQuarterDate(quarter, 'start', 'month', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          {Array.from({length: 12}, (_, i) => (
                            <option key={i+1} value={i+1}>
                              {new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={quarterlyConfig.quarters[quarter].start.day}
                          onChange={(e) => updateQuarterDate(quarter, 'start', 'day', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={quarterlyConfig.quarters[quarter].end.month}
                          onChange={(e) => updateQuarterDate(quarter, 'end', 'month', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          {Array.from({length: 12}, (_, i) => (
                            <option key={i+1} value={i+1}>
                              {new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={quarterlyConfig.quarters[quarter].end.day}
                          onChange={(e) => updateQuarterDate(quarter, 'end', 'day', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      {quarterlyConfig.quarters[quarter].end.nextYear && (
                        <p className="text-xs text-gray-500 mt-1">
                          * This end date is in the following year
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="pt-4 border-t">
                <button
                  onClick={saveQuarterlyConfig}
                  disabled={quarterlyLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {quarterlyLoading ? 'Saving...' : 'Save Quarterly Configuration'}
                </button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">Important Notes</h4>
                    <ul className="mt-1 text-sm text-blue-700 space-y-1">
                      <li>• Changes will affect quarter calculations immediately after saving</li>
                      <li>• All goal filtering and progress tracking uses these dates</li>
                      <li>• Q4 automatically handles year transitions (Oct-Jan)</li>
                      <li>• Make sure dates don't overlap between quarters</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {adminConfig && (
          <div className="bg-white rounded-lg shadow-sm border mt-6">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Admin Configuration</h2>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Configure admin emails, at-risk thresholds, and check-in settings
              </p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Admin Emails Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Admin Email Addresses
                </label>
                <div className="space-y-2">
                  {adminConfig.adminEmails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => updateAdminEmail(index, e.target.value)}
                        placeholder="admin@example.com"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {adminConfig.adminEmails.length > 1 && (
                        <button
                          onClick={() => removeAdminEmail(index)}
                          className="p-2 text-red-600 hover:text-red-800 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addAdminEmail}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Admin Email
                  </button>
                </div>
              </div>

              {/* Employee Management Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Employee Configuration
                  <span className="text-xs text-gray-500 ml-2">(Name, Notion User ID, and Email)</span>
                </label>
                {employeeConfig ? (
                  <div className="space-y-3">
                    {employeeConfig.employees.map((employee, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={employee.name}
                            onChange={(e) => updateEmployee(index, 'name', e.target.value)}
                            placeholder="Full Name"
                            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="text"
                            value={employee.notionUserId}
                            onChange={(e) => updateEmployee(index, 'notionUserId', e.target.value)}
                            placeholder="Notion User ID"
                            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="email"
                            value={employee.email}
                            onChange={(e) => updateEmployee(index, 'email', e.target.value)}
                            placeholder="email@rebootmotion.com"
                            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        {employeeConfig.employees.length > 1 && (
                          <button
                            onClick={() => removeEmployee(index)}
                            className="p-2 text-red-600 hover:text-red-800 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-3">
                      <button
                        onClick={addEmployee}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Add Employee
                      </button>
                      <button
                        onClick={saveEmployeeConfig}
                        disabled={employeeConfigLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {employeeConfigLoading ? 'Saving...' : 'Save Employee Config'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">Loading employee configuration...</div>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  <p>• Find Notion User IDs by checking existing goal assignments in your Notion database</p>
                  <p>• These mappings are used for goal ownership and carry-forward functionality</p>
                </div>
              </div>

              {/* At-Risk Threshold Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  At-Risk Threshold (percentage points behind)
                </label>
                <div className="max-w-xs">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={adminConfig.atRiskThreshold}
                    onChange={(e) => setAdminConfig(prev => ({
                      ...prev,
                      atRiskThreshold: parseInt(e.target.value) || 0
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Goals are marked "at risk" when progress is this many percentage points behind expected timeline
                  </p>
                </div>
              </div>

              {/* SMART Goals Guidance Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Goal Submission Guidance Text
                  <span className="text-xs text-gray-500 ml-2">(Shown in goal approval modals)</span>
                </label>
                <textarea
                  value={adminConfig.smartGoalsGuidance || ''}
                  onChange={(e) => setAdminConfig(prev => ({
                    ...prev,
                    smartGoalsGuidance: e.target.value
                  }))}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter guidance text for users submitting goals..."
                />
                <p className="text-xs text-gray-500 mt-2">
                  This text will appear at the top of goal submission modals to guide users in writing effective Key Results. Supports markdown formatting.
                </p>
              </div>

              {/* Check-in Time Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Automated Check-in Time
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hour (24-hour format)</label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={adminConfig.checkInTime.hour}
                      onChange={(e) => setAdminConfig(prev => ({
                        ...prev,
                        checkInTime: {
                          ...prev.checkInTime,
                          hour: parseInt(e.target.value) || 0
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Timezone</label>
                    <select
                      value={adminConfig.checkInTime.timezone}
                      onChange={(e) => setAdminConfig(prev => ({
                        ...prev,
                        checkInTime: {
                          ...prev.checkInTime,
                          timezone: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Current setting: {adminConfig.checkInTime.hour}:00 {adminConfig.checkInTime.timezone.split('/')[1]?.replace('_', ' ')}
                </p>
              </div>
              
              <div className="pt-4 border-t">
                <button
                  onClick={saveAdminConfig}
                  disabled={adminConfigLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {adminConfigLoading ? 'Saving...' : 'Save Admin Configuration'}
                </button>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Security Notice</h4>
                    <ul className="mt-1 text-sm text-yellow-700 space-y-1">
                      <li>• Only users with email addresses in the admin list can access this page</li>
                      <li>• Changes to admin emails take effect immediately after saving</li>
                      <li>• Make sure at least one admin email is always configured</li>
                      <li>• At-risk threshold affects dashboard goal highlighting</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}