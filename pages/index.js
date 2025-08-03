// pages/index.js - Updated Dashboard with time-normalized at-risk calculation
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Target, TrendingUp, AlertCircle, CheckCircle, Clock, LogOut, Settings, ChevronDown, Plus, BookOpen, ArrowRight, Calendar } from 'lucide-react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [goals, setGoals] = useState([]);
  const [longTermData, setLongTermData] = useState([]);
  const [activeTab, setActiveTab] = useState('current');
  const [loading, setLoading] = useState(true);
  const [longTermLoading, setLongTermLoading] = useState(false);
  const [error, setError] = useState(null);
  const [longTermError, setLongTermError] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [expandedUpdates, setExpandedUpdates] = useState({});
  const [quarterInfo, setQuarterInfo] = useState({ quarter: 'Q1', quarterProgress: 0 });
  const [adminConfig, setAdminConfig] = useState({ atRiskThreshold: 15 });
  const [goalActions, setGoalActions] = useState({});
  const [showCarryForwardModal, setShowCarryForwardModal] = useState(false);
  const [selectedGoalForCarryForward, setSelectedGoalForCarryForward] = useState(null);
  const [carryForwardForm, setCarryForwardForm] = useState({ title: '', focus: '', owner: '' });
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [addGoalForm, setAddGoalForm] = useState({ title: '', focus: '', owner: '' });
  const [employees, setEmployees] = useState([]);
  const [focusOptions, setFocusOptions] = useState([]);
  const [checklistState, setChecklistState] = useState({
    carryOver: false,
    keyPriorities: false,
    owners: false,
    krSubmission: false
  });

  // Function to toggle checklist items
  const toggleChecklistItem = (itemKey) => {
    setChecklistState(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  // Function to toggle update expansion
  const toggleUpdateExpansion = (goalId) => {
    setExpandedUpdates(prev => ({
      ...prev,
      [goalId]: !prev[goalId]
    }));
  };

  // Function to update goal status
  const updateGoalStatus = async (goalId, newStatus) => {
    try {
      const response = await fetch('/api/update-goal-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ goalId, status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update goal status');
      }

      // Update the local goals state
      setGoals(prevGoals => 
        prevGoals.map(goal => 
          goal.id === goalId 
            ? { ...goal, status: newStatus }
            : goal
        )
      );

    } catch (error) {
      console.error('Error updating goal status:', error);
      alert('Failed to update goal status. Please try again.');
    }
  };

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) {
      router.push('/login');
      return;
    }
    fetchGoals();
    fetchQuarterInfo();
    fetchAdminConfig();
    fetchEmployees();
    fetchFocusOptions();
  }, [session, status, router]);

  const fetchQuarterInfo = async () => {
    try {
      const quarterData = await getQuarterInfo();
      setQuarterInfo(quarterData);
    } catch (error) {
      console.error('Error fetching quarter info:', error);
      setQuarterInfo({ quarter: 'Q1', quarterProgress: 0 });
    }
  };

  const fetchAdminConfig = async () => {
    try {
      const response = await fetch('/api/admin/admin-config');
      if (response.ok) {
        const config = await response.json();
        setAdminConfig(config);
      }
    } catch (error) {
      console.error('Error fetching admin config:', error);
      setAdminConfig({ atRiskThreshold: 15 }); // fallback
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('.user-dropdown')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

  const fetchLongTermData = async () => {
    if (longTermData.length > 0) return; // Already loaded
    
    setLongTermLoading(true);
    try {
      const response = await fetch('/api/longterm');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch long term data');
      }
      
      setLongTermData(data.goals);
      setLongTermError(null);
    } catch (err) {
      setLongTermError(err.message);
      console.error('Error:', err);
    } finally {
      setLongTermLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'longterm') {
      fetchLongTermData();
    }
  };

  const handleCarryForwardSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/carry-forward-goal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: carryForwardForm.title,
          focus: carryForwardForm.focus,
          owner: carryForwardForm.owner,
          quarter: getNextQuarter(currentQuarter)
        }),
      });

      if (response.ok) {
        // Mark the goal as carried forward
        setGoalActions(prev => ({
          ...prev,
          [selectedGoalForCarryForward.id]: {
            ...prev[selectedGoalForCarryForward.id],
            carryForward: true
          }
        }));
        
        // Close modal
        setShowCarryForwardModal(false);
        setSelectedGoalForCarryForward(null);
        setCarryForwardForm({ title: '', focus: '', owner: '' });
        
        // Show success message (optional)
        alert('Goal successfully carried forward to ' + getNextQuarter(currentQuarter));
      } else {
        const error = await response.json();
        alert('Error carrying forward goal: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error carrying forward goal');
    }
  };

  const handleCarryForwardCancel = () => {
    setShowCarryForwardModal(false);
    setSelectedGoalForCarryForward(null);
    setCarryForwardForm({ title: '', focus: '', owner: '' });
  };

  const handleAddGoalSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/carry-forward-goal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: addGoalForm.title,
          focus: addGoalForm.focus,
          owner: addGoalForm.owner,
          quarter: getNextQuarter(quarterInfo.quarter),
          isNewGoal: true
        }),
      });

      if (response.ok) {
        alert(`New ${getNextQuarter(quarterInfo.quarter)} goal created successfully!`);
        setShowAddGoalModal(false);
        setAddGoalForm({ title: '', focus: '', owner: '' });
      } else {
        throw new Error('Failed to create goal');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Failed to create goal. Please try again.');
    }
  };

  const handleAddGoalCancel = () => {
    setShowAddGoalModal(false);
    setAddGoalForm({ title: '', focus: '', owner: '' });
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      // Fallback to hardcoded list
      setEmployees([
        { name: 'Jimmy Buffi' },
        { name: 'Evan Demchick' },
        { name: 'Robert Calise' },
        { name: 'Creagor Elsom' },
        { name: 'Jacob Howenstein' }
      ]);
    }
  };

  const fetchFocusOptions = async () => {
    try {
      const response = await fetch('/api/focus-options');
      if (response.ok) {
        const data = await response.json();
        setFocusOptions(data.focusOptions);
      }
    } catch (error) {
      console.error('Error fetching focus options:', error);
      // Fallback to basic options
      setFocusOptions([
        { name: 'MLB Teams', color: 'blue' },
        { name: 'NBA Teams', color: 'purple' },
        { name: 'Product', color: 'green' },
        { name: 'Infrastructure', color: 'orange' }
      ]);
    }
  };

  const fetchGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch goals');
      }
      
      setGoals(data.goals);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Function to determine current quarter and calculate progress through it
  const getQuarterInfo = async () => {
    try {
      const response = await fetch('/api/admin/quarterly-config');
      if (response.ok) {
        const config = await response.json();
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();

        // Check each quarter to see which one we're in
        for (const [quarterName, quarterConfig] of Object.entries(config.quarters)) {
          const { start, end } = quarterConfig;
          
          let startDate, endDate;
          
          if (end.nextYear) {
            // Handle Q4 case where end date is in next year
            startDate = new Date(year, start.month - 1, start.day);
            endDate = new Date(year + 1, end.month - 1, end.day);
            
            if ((month > start.month || (month === start.month && day >= start.day)) ||
                (month < end.month || (month === end.month && day <= end.day))) {
              
              const totalQuarterDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const daysSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const quarterProgress = Math.max(0, Math.min(1, daysSinceStart / totalQuarterDays));
              
              return { quarter: quarterName, quarterProgress: quarterProgress * 100 };
            }
          } else {
            // Handle normal quarters within the same year
            startDate = new Date(year, start.month - 1, start.day);
            endDate = new Date(year, end.month - 1, end.day);
            
            if ((month > start.month || (month === start.month && day >= start.day)) &&
                (month < end.month || (month === end.month && day <= end.day))) {
              
              const totalQuarterDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const daysSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const quarterProgress = Math.max(0, Math.min(1, daysSinceStart / totalQuarterDays));
              
              return { quarter: quarterName, quarterProgress: quarterProgress * 100 };
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching quarterly config:', error);
    }
    
    // Fallback to default if config fetch fails
    return { quarter: 'Q1', quarterProgress: 0 };
  };

  // Function to determine if a goal is at risk based on configurable threshold
  const isGoalAtRisk = (completion, quarterProgress, threshold = 15) => {
    // Goal is at risk if completion percentage is behind expected progress by the threshold amount
    return completion < (quarterProgress - threshold);
  };

  // Function to get the next quarter
  const getNextQuarter = (currentQuarter) => {
    const quarterMap = { 'Q1': 'Q2', 'Q2': 'Q3', 'Q3': 'Q4', 'Q4': 'Q1' };
    return quarterMap[currentQuarter] || 'Q1';
  };

  // Function to calculate important quarterly planning dates
  const getQuarterlyPlanningDates = (nextQuarter) => {
    // Define quarter start dates based on config
    const quarterConfig = {
      'Q1': { month: 1, day: 12 },   // Jan 12
      'Q2': { month: 4, day: 12 },   // Apr 12  
      'Q3': { month: 7, day: 12 },   // Jul 12
      'Q4': { month: 10, day: 12 }   // Oct 12
    };

    const nextQuarterStart = quarterConfig[nextQuarter];
    if (!nextQuarterStart) return null;

    const currentYear = new Date().getFullYear();
    let startYear = currentYear;
    
    // Handle Q1 which starts in the next year
    if (nextQuarter === 'Q1') {
      startYear = currentYear + 1;
    }

    const quarterStartDate = new Date(startYear, nextQuarterStart.month - 1, nextQuarterStart.day);
    
    // Calculate deadlines
    const krDeadline = new Date(quarterStartDate);
    krDeadline.setDate(krDeadline.getDate() - 7); // 1 week before quarter start
    
    const goalPlanningDeadline = new Date(quarterStartDate);
    goalPlanningDeadline.setDate(goalPlanningDeadline.getDate() - 14); // 2 weeks before quarter start

    return {
      quarterStart: quarterStartDate,
      krSubmissionDeadline: krDeadline,
      goalPlanningDeadline: goalPlanningDeadline
    };
  };

  // Function to check if current user is admin
  const isAdmin = () => {
    if (!session?.user?.email) return false;
    const adminEmails = ['edemchick@rebootmotion.com', 'jbuffi@rebootmotion.com'];
    return adminEmails.includes(session.user.email);
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'achieved':
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'in progress':
        return 'text-blue-600 bg-blue-50';
      case 'carried forward':
        return 'text-yellow-600 bg-yellow-50';
      case 'at risk':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getFocusColor = (focus) => {
    // Create distinct, vibrant colors for different focus areas
    const focusColors = {
      'All': 'text-violet-700 bg-violet-100',
      'MLB Teams': 'text-blue-700 bg-blue-100',
      'NBA Teams': 'text-purple-700 bg-purple-100',
      'NBA Growth': 'text-fuchsia-700 bg-fuchsia-100',
      'MLB League Office': 'text-emerald-700 bg-emerald-100',
      'Product': 'text-green-700 bg-green-100',
      'Infrastructure': 'text-orange-700 bg-orange-100',
      'Business Development': 'text-indigo-700 bg-indigo-100',
      'Customer Success': 'text-teal-700 bg-teal-100',
      'Security': 'text-red-700 bg-red-100',
      'Engineering': 'text-cyan-700 bg-cyan-100',
      'General': 'text-amber-700 bg-amber-100'
    };

    // Handle multiple focuses (comma separated) with a distinct color
    if (focus.includes(',')) {
      return 'text-pink-700 bg-pink-100';
    }

    return focusColors[focus] || 'text-slate-700 bg-slate-100';
  };

  const getCompletionColor = (completion) => {
    if (completion >= 80) return 'bg-green-500';
    if (completion >= 60) return 'bg-blue-500';
    if (completion >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const organizeLongTermData = () => {
    const fiveYear = longTermData.filter(item => item.type === '5 Year Vision');
    const threeYear = longTermData.filter(item => item.type === '3 Year Picture');
    const annual = longTermData.filter(item => item.type === 'Annual Plan');
    
    return { fiveYear, threeYear, annual };
  };

  const renderLongTermSection = (title, data, iconColor = 'text-blue-600') => {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className={`h-5 w-5 ${iconColor}`} />
          {title}
        </h3>
        {data.length === 0 ? (
          <p className="text-gray-500 text-sm">No items found for this section.</p>
        ) : (
          <div className="space-y-4">
            {data.map((item, index) => (
              <div key={index} className="border-l-4 border-blue-200 pl-4">
                <h4 className="font-medium text-gray-900 mb-2">{item.name}</h4>
                <div className="space-y-1 mb-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Goal:</span> {item.goal}
                  </p>
                  {item.progress && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Progress{item.progressDate ? ` (as of ${new Date(item.progressDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })})` : ''}:</span> {item.progress}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 max-w-xs">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getCompletionColor(item.progressNumber || 0)}`}
                        style={{ width: `${item.progressNumber || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect to login
  }

  const { quarter: currentQuarter, quarterProgress } = quarterInfo;
  
  // Filter goals: show only current quarter, exclude "Non Priorities"
  const currentGoals = goals.filter(goal => 
    goal.quarter === currentQuarter && 
    goal.quarter !== 'Non Priorities' && 
    goal.quarter !== 'Not Prioritized' && 
    goal.quarter !== 'Backlog'
  );

  const overallProgress = currentGoals.length > 0 
    ? Math.round(currentGoals.reduce((sum, goal) => sum + goal.completion, 0) / currentGoals.length)
    : 0;

  const goalsAtRisk = currentGoals.filter(goal => isGoalAtRisk(goal.completion, quarterProgress, adminConfig.atRiskThreshold));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reboot OS Control Tower</h1>
              <div className="flex items-center gap-6 mt-3">
                <button
                  onClick={() => handleTabChange('current')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'current'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Current Goals
                </button>
                <button
                  onClick={() => handleTabChange('longterm')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'longterm'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Long Term
                </button>
                {isAdmin() && (
                  <button
                    onClick={() => handleTabChange('q4prep')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'q4prep'
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {getNextQuarter(currentQuarter)} Prep (WIP)
                  </button>
                )}
              </div>
              {activeTab === 'current' && (
                <p className="text-sm text-gray-500 mt-2">
                  {Math.round(quarterProgress)}% through {currentQuarter} • Expected progress: {Math.round(quarterProgress)}%
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {activeTab === 'current' && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{overallProgress}%</div>
                  <div className="text-sm text-gray-500">{currentQuarter} Progress</div>
                </div>
              )}
              <div className="relative user-dropdown">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <span>Welcome, {session.user.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      {isAdmin() && (
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            router.push('/admin');
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Settings className="h-4 w-4" />
                          Admin Settings
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          signOut();
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'current' ? (
          loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading goals...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
              <p className="text-red-600 text-sm mt-2">
                Check your environment variables and database sharing settings.
              </p>
            </div>
          ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <Target className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{currentQuarter} Goals</p>
                    <p className="text-2xl font-bold text-gray-900">{currentGoals.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {currentGoals.filter(g => g.completion >= 100).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Progress</p>
                    <p className="text-2xl font-bold text-gray-900">{overallProgress}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">At Risk</p>
                    <p className="text-2xl font-bold text-gray-900">{goalsAtRisk.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Goals List */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">{currentQuarter} 2025 Goals</h2>
              
              {currentGoals.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No {currentQuarter} Goals Found</h3>
                  <p className="text-gray-600">
                    No goals found for the current quarter ({currentQuarter}). Check your Notion database or wait for goals to be added.
                  </p>
                </div>
              ) : (
                currentGoals.map((goal) => {
                  const atRisk = isGoalAtRisk(goal.completion, quarterProgress, adminConfig.atRiskThreshold);
                  
                  return (
                    <div 
                      key={goal.id} 
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 
                              className="text-lg font-medium text-gray-900" 
                              dangerouslySetInnerHTML={{ __html: goal.titleWithLinks || goal.title }}
                            ></h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(goal.status)}`}>
                              {goal.status}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFocusColor(goal.focus)}`}>
                              {goal.focus}
                            </span>
                            {atRisk && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                At Risk
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Owner: {goal.owner}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Updated: {new Date(goal.lastUpdated).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">{goal.completion}%</div>
                          <div className="text-sm text-gray-500">Complete</div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getCompletionColor(goal.completion)}`}
                            style={{ width: `${goal.completion}%` }}
                          ></div>
                        </div>
                      </div>


                      {/* Key Results */}
                      {(goal.keyResults || goal.completedKRs) && (
                        <div>
                          {goal.keyResults && (
                            <div className="mb-3">
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Open KRs:</h4>
                              <div 
                                className="text-sm text-gray-600 whitespace-pre-line"
                                dangerouslySetInnerHTML={{ __html: goal.keyResults }}
                              ></div>
                            </div>
                          )}
                          {goal.completedKRs && (
                            <div className="mb-3">
                              <h4 className="text-sm font-medium text-green-700 mb-2">Completed KRs:</h4>
                              <div 
                                className="text-sm text-green-600 whitespace-pre-line"
                                dangerouslySetInnerHTML={{ __html: goal.completedKRs }}
                              ></div>
                            </div>
                          )}
                          
                          {goal.latestUpdateDate && (goal.latestUpdateWentWell || goal.latestUpdateChallenges) && (
                            <div>
                              <button
                                onClick={() => toggleUpdateExpansion(goal.id)}
                                className="flex items-center gap-2 w-full text-left text-sm font-medium text-blue-700 hover:text-blue-800 mb-2 transition-colors"
                              >
                                <ChevronDown 
                                  className={`h-4 w-4 transition-transform ${
                                    expandedUpdates[goal.id] ? 'rotate-180' : ''
                                  }`} 
                                />
                                {new Date(goal.latestUpdateDate).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: new Date(goal.latestUpdateDate).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                })} Update
                              </button>
                              
                              {expandedUpdates[goal.id] && (
                                <div className="ml-6 space-y-3 text-sm">
                                  {goal.latestUpdateWentWell && (
                                    <div>
                                      <span className="font-medium text-green-700">✅ What went well:</span>
                                      <div className="text-gray-600 whitespace-pre-line mt-1">
                                        {goal.latestUpdateWentWell}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {goal.latestUpdateChallenges && (
                                    <div>
                                      <span className="font-medium text-orange-700">⚠️ Challenges:</span>
                                      <div className="text-gray-600 whitespace-pre-line mt-1">
                                        {goal.latestUpdateChallenges}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {goal.latestUpdateCompletedKRs && (
                                    <div>
                                      <span className="font-medium text-blue-700">🎯 KRs to mark complete:</span>
                                      <div className="text-gray-600 whitespace-pre-line mt-1">
                                        {goal.latestUpdateCompletedKRs}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )
        ) : activeTab === 'longterm' ? (
          longTermLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading long term goals...</p>
            </div>
          ) : longTermError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-red-800">{longTermError}</p>
              </div>
              <p className="text-red-600 text-sm mt-2">
                Check your environment variables and long term database sharing settings.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <h2 className="text-lg font-semibold text-gray-900">Long Term Strategic Goals</h2>
              
              {(() => {
                const { fiveYear, threeYear, annual } = organizeLongTermData();
                return (
                  <div className="space-y-8">
                    {renderLongTermSection('5 Year Vision', fiveYear, 'text-purple-600')}
                    {renderLongTermSection('3 Year Picture', threeYear, 'text-blue-600')}
                    {renderLongTermSection('Annual Plan', annual, 'text-green-600')}
                  </div>
                );
              })()}
            </div>
          )
        ) : (
          // Q4 Preparation Tab
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{getNextQuarter(currentQuarter)} 2025 Preparation (WIP)</h2>
              <p className="text-gray-600">Plan and prepare for the upcoming quarter</p>
            </div>

            {/* Quarterly Preparation Checklist */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                {getNextQuarter(currentQuarter)} Preparation Checklist
              </h3>
              {(() => {
                const nextQuarter = getNextQuarter(currentQuarter);
                const dates = getQuarterlyPlanningDates(nextQuarter);
                const goalPlanningDate = dates?.goalPlanningDeadline?.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                });
                const krDeadlineDate = dates?.krSubmissionDeadline?.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric' 
                });
                
                return (
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 text-sm cursor-pointer hover:bg-blue-100 p-2 rounded">
                      <input 
                        type="checkbox" 
                        className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        checked={checklistState.carryOver}
                        onChange={() => toggleChecklistItem('carryOver')} 
                      />
                      <span className={`text-blue-800 ${checklistState.carryOver ? 'line-through opacity-60' : ''}`}>
                        <strong>1. Decide which {currentQuarter} goals should carry over</strong>
                        <div className="text-blue-600 mt-1 text-xs">
                          Review incomplete goals and determine which ones to continue in {nextQuarter}
                          {goalPlanningDate && <div className="text-blue-700 font-medium">⏰ Complete by: {goalPlanningDate}</div>}
                        </div>
                      </span>
                    </label>
                    
                    <label className="flex items-start gap-3 text-sm cursor-pointer hover:bg-blue-100 p-2 rounded">
                      <input 
                        type="checkbox" 
                        className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        checked={checklistState.keyPriorities}
                        onChange={() => toggleChecklistItem('keyPriorities')} 
                      />
                      <span className={`text-blue-800 ${checklistState.keyPriorities ? 'line-through opacity-60' : ''}`}>
                        <strong>2. Decide key priorities for {nextQuarter}</strong>
                        <div className="text-blue-600 mt-1 text-xs">
                          Identify 3-5 strategic objectives for the upcoming quarter
                          {goalPlanningDate && <div className="text-blue-700 font-medium">⏰ Complete by: {goalPlanningDate}</div>}
                        </div>
                      </span>
                    </label>
                    
                    <label className="flex items-start gap-3 text-sm cursor-pointer hover:bg-blue-100 p-2 rounded">
                      <input 
                        type="checkbox" 
                        className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        checked={checklistState.owners}
                        onChange={() => toggleChecklistItem('owners')} 
                      />
                      <span className={`text-blue-800 ${checklistState.owners ? 'line-through opacity-60' : ''}`}>
                        <strong>3. Decide owners for key priorities</strong>
                        <div className="text-blue-600 mt-1 text-xs">
                          Assign clear ownership for each {nextQuarter} objective
                          {goalPlanningDate && <div className="text-blue-700 font-medium">⏰ Complete by: {goalPlanningDate}</div>}
                        </div>
                      </span>
                    </label>
                    
                    <label className="flex items-start gap-3 text-sm cursor-pointer hover:bg-blue-100 p-2 rounded">
                      <input 
                        type="checkbox" 
                        className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        checked={checklistState.krSubmission}
                        onChange={() => toggleChecklistItem('krSubmission')} 
                      />
                      <span className={`text-blue-800 ${checklistState.krSubmission ? 'line-through opacity-60' : ''}`}>
                        <strong>4. All KRs submitted by goal owners</strong>
                        <div className="text-blue-600 mt-1 text-xs">
                          Ensure all goal owners have submitted their Key Results for approval
                          {krDeadlineDate && <div className="text-blue-700 font-medium">⏰ Deadline: {krDeadlineDate}</div>}
                        </div>
                      </span>
                    </label>
                  </div>
                );
              })()}
            </div>

            {/* Q3 Goals Review */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                {currentQuarter} Goals Review
              </h3>
              {currentGoals.length > 0 ? (
                <div className="space-y-4">
                  {currentGoals.map((goal) => (
                    <div key={goal.id} className={`border border-gray-200 rounded-lg p-4 ${goal.status === 'Achieved' || goal.status === 'Carried Forward' ? 'opacity-75 line-through' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className={`font-medium text-gray-900 ${goalActions[goal.id]?.markComplete || goalActions[goal.id]?.carryForward ? 'line-through' : ''}`}>{goal.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium text-gray-600 ${goalActions[goal.id]?.markComplete || goalActions[goal.id]?.carryForward ? 'line-through' : ''}`}>{goal.completion}%</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getCompletionColor(goal.completion)}`}
                              style={{ width: `${goal.completion}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span className={goalActions[goal.id]?.markComplete || goalActions[goal.id]?.carryForward ? 'line-through' : ''}>Owner: {goal.owner}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFocusColor(goal.focus)} ${goalActions[goal.id]?.markComplete || goalActions[goal.id]?.carryForward ? 'line-through' : ''}`}>
                          {goal.focus}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300"
                            checked={goal.status === 'Achieved'}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateGoalStatus(goal.id, 'Achieved');
                              } else {
                                updateGoalStatus(goal.id, 'In Progress');
                              }
                            }}
                          />
                          <span className="text-gray-700">Mark as complete, or</span>
                        </label>
                        {goal.completion < 100 && (
                          <label className="flex items-center gap-2 text-sm">
                            <input 
                              type="checkbox" 
                              className="rounded border-gray-300"
                              checked={goal.status === 'Carried Forward'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  // Update status in Notion first
                                  updateGoalStatus(goal.id, 'Carried Forward');
                                  // Then show carry forward modal for DM
                                  setSelectedGoalForCarryForward(goal);
                                  setCarryForwardForm({
                                    title: goal.title,
                                    focus: goal.focus,
                                    owner: goal.owner
                                  });
                                  setShowCarryForwardModal(true);
                                } else {
                                  updateGoalStatus(goal.id, 'In Progress');
                                }
                              }}
                            />
                            <span className={`text-gray-700 ${goalActions[goal.id]?.markComplete || goalActions[goal.id]?.carryForward ? 'line-through' : ''}`}>
                              Carry forward to {getNextQuarter(currentQuarter)}
                              {goalActions[goal.id]?.carryForward && (
                                <span className="ml-2 text-xs text-blue-600 font-medium">(pending)</span>
                              )}
                            </span>
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No {currentQuarter} goals found to review.</p>
              )}
            </div>

            {/* Q4 Goal Planning */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                {getNextQuarter(currentQuarter)} Goal Planning
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-gray-600">Start planning your {getNextQuarter(currentQuarter)} objectives</p>
                  <button 
                    onClick={() => setShowAddGoalModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add {getNextQuarter(currentQuarter)} Goal
                  </button>
                </div>
                

                {/* Next Quarter Timeline */}
                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">{getNextQuarter(currentQuarter)} 2025 Timeline</h4>
                  <div className="text-sm text-gray-600">
                    <p><strong>{getNextQuarter(currentQuarter)} Start:</strong> {getNextQuarter(currentQuarter) === 'Q1' ? 'January 11, 2026' : getNextQuarter(currentQuarter) === 'Q2' ? 'April 11, 2025' : getNextQuarter(currentQuarter) === 'Q3' ? 'July 11, 2025' : 'October 11, 2025'}</p>
                    <p><strong>{getNextQuarter(currentQuarter)} End:</strong> {getNextQuarter(currentQuarter) === 'Q1' ? 'April 10, 2026' : getNextQuarter(currentQuarter) === 'Q2' ? 'July 10, 2025' : getNextQuarter(currentQuarter) === 'Q3' ? 'October 10, 2025' : 'January 10, 2026'}</p>
                    <p><strong>Duration:</strong> ~13 weeks</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Carry Forward Modal */}
      {showCarryForwardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Carry Forward Goal to {getNextQuarter(currentQuarter)}
            </h3>
            
            <form onSubmit={handleCarryForwardSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title
                </label>
                <input
                  type="text"
                  value={carryForwardForm.title}
                  onChange={(e) => setCarryForwardForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Focus Area
                </label>
                <select
                  value={carryForwardForm.focus}
                  onChange={(e) => setCarryForwardForm(prev => ({ ...prev, focus: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Focus Area</option>
                  {focusOptions.map(focus => (
                    <option key={focus.name} value={focus.name}>{focus.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner
                </label>
                <select
                  value={carryForwardForm.owner}
                  onChange={(e) => setCarryForwardForm(prev => ({ ...prev, owner: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Owner</option>
                  {employees.map(employee => (
                    <option key={employee.name} value={employee.name}>{employee.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCarryForwardCancel}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Carry Forward Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              New {getNextQuarter(quarterInfo.quarter)} Goal
            </h3>
            
            <form onSubmit={handleAddGoalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title
                </label>
                <input
                  type="text"
                  value={addGoalForm.title}
                  onChange={(e) => setAddGoalForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Focus Area
                </label>
                <select
                  value={addGoalForm.focus}
                  onChange={(e) => setAddGoalForm(prev => ({ ...prev, focus: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Focus Area</option>
                  {focusOptions.map(focus => (
                    <option key={focus.name} value={focus.name}>{focus.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner
                </label>
                <select
                  value={addGoalForm.owner}
                  onChange={(e) => setAddGoalForm(prev => ({ ...prev, owner: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Owner</option>
                  {employees.map(employee => (
                    <option key={employee.name} value={employee.name}>{employee.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleAddGoalCancel}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
