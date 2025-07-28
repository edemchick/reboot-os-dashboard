import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { ArrowLeft, Clock, Save, AlertCircle, MessageSquare } from 'lucide-react';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scheduleData, setScheduleData] = useState({
    day: 'Monday',
    enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [statusData, setStatusData] = useState(null);
  const [slackLoading, setSlackLoading] = useState(false);

  // Check if current user is admin
  const isAdmin = () => {
    if (!session?.user?.email) return false;
    const adminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
    return adminEmails.includes(session.user.email);
  };

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }
    
    if (!isAdmin()) {
      router.push('/');
      return;
    }

    fetchScheduleSettings();
    fetchStatusData();
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
              Configure automated Slack check-ins sent at 10:00 AM Eastern Time
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

            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Day of Week
              </label>
              <select
                value={scheduleData.day}
                onChange={(e) => handleInputChange('day', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Monday">Monday at 10:00 AM Eastern</option>
                <option value="Tuesday">Tuesday at 10:00 AM Eastern</option>
                <option value="Wednesday">Wednesday at 10:00 AM Eastern</option>
                <option value="Thursday">Thursday at 10:00 AM Eastern</option>
                <option value="Friday">Friday at 10:00 AM Eastern</option>
                <option value="Saturday">Saturday at 10:00 AM Eastern</option>
                <option value="Sunday">Sunday at 10:00 AM Eastern</option>
              </select>
            </div>

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
                    <li>• Check-ins are sent automatically at 10:00 AM Eastern Time</li>
                    <li>• Check-ins will be sent to all goal owners on the selected day</li>
                    <li>• The manual "Send Manual Check-In" button will still work regardless of this setting</li>
                    <li>• Changes take effect immediately after saving</li>
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
                    <span className="text-sm font-medium text-gray-500">Current Time (Eastern):</span>
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
      </div>
    </div>
  );
}