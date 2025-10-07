// pages/index.js - Updated Dashboard with time-normalized at-risk calculation
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Target, TrendingUp, AlertCircle, CheckCircle, Clock, LogOut, Settings, ChevronDown, ChevronRight, ChevronUp, Plus, BookOpen, ArrowRight, Calendar } from 'lucide-react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [goals, setGoals] = useState([]);
  const [longTermData, setLongTermData] = useState([]);
  const [manifestoData, setManifestoData] = useState([]);
  const [activeTab, setActiveTab] = useState('manifesto');
  const [loading, setLoading] = useState(true);
  const [longTermLoading, setLongTermLoading] = useState(false);
  const [manifestoLoading, setManifestoLoading] = useState(false);
  const [error, setError] = useState(null);
  const [longTermError, setLongTermError] = useState(null);
  const [manifestoError, setManifestoError] = useState(null);
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
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState(null);
  const [expandedPartners, setExpandedPartners] = useState({});
  const [partnerSort, setPartnerSort] = useState({ key: null, direction: 'asc' });


  // Fetch partners data from API
  const fetchPartners = async () => {
    setPartnersLoading(true);
    setPartnersError(null);
    try {
      const response = await fetch('/api/partners');
      if (!response.ok) {
        throw new Error('Failed to fetch partners');
      }
      const data = await response.json();
      setPartners(data);
    } catch (error) {
      console.error('Error fetching partners:', error);
      setPartnersError(error.message);
    } finally {
      setPartnersLoading(false);
    }
  };

  // Function to toggle partner row expansion
  const togglePartnerExpansion = (partnerId) => {
    setExpandedPartners(prev => ({
      ...prev,
      [partnerId]: !prev[partnerId]
    }));
  };

  // Function to handle partner sorting
  const handlePartnerSort = (key) => {
    const direction = partnerSort.key === key && partnerSort.direction === 'asc' ? 'desc' : 'asc';
    setPartnerSort({ key, direction });
  };

  // Function to get sorted partners
  const getSortedPartners = () => {
    if (!partnerSort.key) return partners;
    
    return [...partners].sort((a, b) => {
      let aValue, bValue;
      
      switch (partnerSort.key) {
        case 'partnerName':
          aValue = a.partnerName?.toLowerCase() || '';
          bValue = b.partnerName?.toLowerCase() || '';
          break;
        case 'category':
          aValue = a.category?.toLowerCase() || '';
          bValue = b.category?.toLowerCase() || '';
          break;
        case 'mainContact':
          aValue = a.mainContact?.toLowerCase() || '';
          bValue = b.mainContact?.toLowerCase() || '';
          break;
        case 'currentHealthScore':
          aValue = parseFloat(a.currentHealthScore) || 0;
          bValue = parseFloat(b.currentHealthScore) || 0;
          break;
        case 'trend':
          aValue = (a.currentHealthScore || 0) - (a.previousHealthScore || 0);
          bValue = (b.currentHealthScore || 0) - (b.previousHealthScore || 0);
          break;
        case 'lastUpdated':
          aValue = new Date(a.lastUpdated || 0);
          bValue = new Date(b.lastUpdated || 0);
          break;
        default:
          return 0;
      }
      
      if (partnerSort.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
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

  // Read initial tab from URL on page load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      const validTabs = ['manifesto', 'longterm', 'current', 'data'];
      
      if (tabParam && validTabs.includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

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

  // Fetch tab-specific data when activeTab changes
  useEffect(() => {
    if (status === 'loading' || !session) return;
    
    if (activeTab === 'manifesto') {
      fetchManifesto();
    } else if (activeTab === 'longterm') {
      fetchLongTermData();
    } else if (activeTab === 'data') {
      fetchPartners();
    }
    // 'current' tab uses already loaded goals data, no additional fetch needed
  }, [activeTab, session, status]);

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

  const fetchManifesto = async () => {
    setManifestoLoading(true);
    setManifestoError(null);
    try {
      const response = await fetch('/api/manifesto');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch manifesto data');
      }
      
      setManifestoData(data);
      setManifestoError(null);
    } catch (err) {
      setManifestoError(err.message);
      console.error('Error:', err);
    } finally {
      setManifestoLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    // Update URL without triggering a page reload
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('tab', tab);
      const newUrl = window.location.pathname + '?' + urlParams.toString();
      window.history.pushState({}, '', newUrl);
    }
    
    if (tab === 'manifesto') {
      fetchManifesto();
    } else if (tab === 'longterm') {
      fetchLongTermData();
    } else if (tab === 'data') {
      fetchPartners();
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
  // Using standard calendar quarters: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
  const getQuarterInfo = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed (0 = January, 11 = December)

    let quarter, startDate, endDate;

    if (month >= 0 && month <= 2) {
      // Q1: January 1 - March 31
      quarter = 'Q1';
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 2, 31);
    } else if (month >= 3 && month <= 5) {
      // Q2: April 1 - June 30
      quarter = 'Q2';
      startDate = new Date(year, 3, 1);
      endDate = new Date(year, 5, 30);
    } else if (month >= 6 && month <= 8) {
      // Q3: July 1 - September 30
      quarter = 'Q3';
      startDate = new Date(year, 6, 1);
      endDate = new Date(year, 8, 30);
    } else {
      // Q4: October 1 - December 31
      quarter = 'Q4';
      startDate = new Date(year, 9, 1);
      endDate = new Date(year, 11, 31);
    }

    // Calculate progress through the quarter
    const totalQuarterDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const quarterProgress = Math.max(0, Math.min(100, (daysSinceStart / totalQuarterDays) * 100));

    return {
      quarter,
      quarterProgress,
      startDate,
      endDate
    };
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
    const fiveYear = longTermData.filter(item => item.type.includes('5 Year Vision'));
    const threeYear = longTermData.filter(item => item.type.includes('3 Year Picture'));
    const annual = longTermData.filter(item => item.type.includes('Annual Plan'));
    
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
                  onClick={() => handleTabChange('manifesto')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'manifesto'
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Reboot Manifesto
                </button>
                <button
                  onClick={() => handleTabChange('longterm')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'longterm'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Long-Term Vision
                </button>
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
                  onClick={() => handleTabChange('data')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'data'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Data
                </button>
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
                        <>
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
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              router.push('/people-analyzer');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <Target className="h-4 w-4 text-red-600" />
                            People Analyzer
                          </button>
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              router.push('/admin/q4-prep');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <Calendar className="h-4 w-4 text-green-600" />
                            {getNextQuarter(currentQuarter)} Prep
                          </button>
                        </>
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
        {activeTab === 'manifesto' ? (
          manifestoLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading manifesto...</p>
            </div>
          ) : manifestoError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-red-800">{manifestoError}</p>
              </div>
              <p className="text-red-600 text-sm mt-2">
                Check your NOTION_MANIFESTO_PAGE_ID environment variable and page sharing settings.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Hero Section */}
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">{manifestoData.title || 'The Reboot Manifesto'}</h2>
                <p className="text-lg text-gray-600">Our mission, values, and beliefs that guide everything we do</p>
                {manifestoData.lastEdited && (
                  <p className="text-sm text-orange-500 mt-3">
                    Last updated: {new Date(manifestoData.lastEdited).toLocaleDateString()}
                  </p>
                )}
              </div>
              
              <div className="flex gap-8">
                {/* Table of Contents */}
                {manifestoData.navigation && manifestoData.navigation.length > 0 && (
                  <div className="w-72 flex-shrink-0">
                    <div className="sticky top-20 bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">
                        Table of Contents
                      </h3>
                      <nav className="space-y-1">
                        {manifestoData.navigation.map((item, index) => (
                          <a
                            key={index}
                            href={`#${item.id}`}
                            className={`block text-sm hover:text-orange-500 transition-colors duration-200 ${
                              item.level === 1 ? 'font-medium text-gray-900' :
                              item.level === 2 ? 'text-gray-700 ml-3' :
                              'text-gray-600 ml-6'
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              document.getElementById(item.id)?.scrollIntoView({ 
                                behavior: 'smooth',
                                block: 'start'
                              });
                            }}
                          >
                            {item.title}
                          </a>
                        ))}
                      </nav>
                    </div>
                  </div>
                )}
                
                {/* Main Content */}
                <div className="flex-1">
                  {manifestoData.content ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-none">
                      <style jsx global>{`
                        .animate-fade-in {
                          animation: fadeInUp 0.6s ease-out forwards;
                          opacity: 0;
                          transform: translateY(10px);
                        }
                        
                        @keyframes fadeInUp {
                          to {
                            opacity: 1;
                            transform: translateY(0);
                          }
                        }
                        
                        .animate-fade-in:nth-child(1) { animation-delay: 0.1s; }
                        .animate-fade-in:nth-child(2) { animation-delay: 0.15s; }
                        .animate-fade-in:nth-child(3) { animation-delay: 0.2s; }
                        .animate-fade-in:nth-child(4) { animation-delay: 0.25s; }
                        .animate-fade-in:nth-child(5) { animation-delay: 0.3s; }
                        
                        html {
                          scroll-behavior: smooth;
                        }
                      `}</style>
                      <div 
                        className="prose prose-lg max-w-none"
                        dangerouslySetInnerHTML={{ __html: manifestoData.content }}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No manifesto content found.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        ) : activeTab === 'current' ? (
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
                              Updated: {(() => {
                                if (goal.latestUpdateDate) {
                                  const [year, month, day] = goal.latestUpdateDate.split('-');
                                  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString();
                                } else {
                                  return new Date(goal.lastUpdated).toLocaleDateString();
                                }
                              })()}
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
                          
                          {goal.latestUpdateDate && (goal.latestUpdateWentWell || goal.latestUpdateChallenges || goal.latestUpdateNextWeekFocus) && (
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
                                {(() => {
                                  const [year, month, day] = goal.latestUpdateDate.split('-');
                                  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                  return date.toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                  });
                                })()} Update
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
                                  
                                  {goal.latestUpdateNextWeekFocus && (
                                    <div>
                                      <span className="font-medium text-purple-700">📅 Next week focus:</span>
                                      <div className="text-gray-600 whitespace-pre-line mt-1">
                                        {goal.latestUpdateNextWeekFocus}
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
                    {renderLongTermSection(fiveYear[0]?.type || '5 Year Vision', fiveYear, 'text-purple-600')}
                    {renderLongTermSection(threeYear[0]?.type || '3 Year Picture', threeYear, 'text-blue-600')}
                    {renderLongTermSection(annual[0]?.type || 'Annual Plan', annual, 'text-green-600')}
                  </div>
                );
              })()}
            </div>
          )
        ) : activeTab === 'data' ? (
          // Data Tab - Partner Scorecard
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Partner Scorecard</h2>
                <p className="text-gray-600 mt-1">Active partner relationships and health scores</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  {partners.length} Active Partners
                </div>
              </div>
            </div>

            {partnersLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading partner data...</p>
              </div>
            ) : partnersError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-red-800">{partnersError}</p>
                </div>
                <p className="text-red-600 text-sm mt-2">
                  Check your NOTION_PARTNERS_DATABASE_ID environment variable and database sharing settings.
                </p>
              </div>
            ) : partners.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No active partners found</p>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handlePartnerSort('partnerName')}
                        >
                          <div className="flex items-center gap-2">
                            Partner
                            <div className="flex flex-col">
                              <ChevronUp className={`h-3 w-3 ${partnerSort.key === 'partnerName' && partnerSort.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                              <ChevronDown className={`h-3 w-3 ${partnerSort.key === 'partnerName' && partnerSort.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handlePartnerSort('category')}
                        >
                          <div className="flex items-center gap-2">
                            Category
                            <div className="flex flex-col">
                              <ChevronUp className={`h-3 w-3 ${partnerSort.key === 'category' && partnerSort.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                              <ChevronDown className={`h-3 w-3 ${partnerSort.key === 'category' && partnerSort.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handlePartnerSort('mainContact')}
                        >
                          <div className="flex items-center gap-2">
                            Main Contact
                            <div className="flex flex-col">
                              <ChevronUp className={`h-3 w-3 ${partnerSort.key === 'mainContact' && partnerSort.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                              <ChevronDown className={`h-3 w-3 ${partnerSort.key === 'mainContact' && partnerSort.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handlePartnerSort('currentHealthScore')}
                        >
                          <div className="flex items-center gap-2">
                            Health Score
                            <div className="flex flex-col">
                              <ChevronUp className={`h-3 w-3 ${partnerSort.key === 'currentHealthScore' && partnerSort.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                              <ChevronDown className={`h-3 w-3 ${partnerSort.key === 'currentHealthScore' && partnerSort.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handlePartnerSort('trend')}
                        >
                          <div className="flex items-center gap-2">
                            Trend
                            <div className="flex flex-col">
                              <ChevronUp className={`h-3 w-3 ${partnerSort.key === 'trend' && partnerSort.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                              <ChevronDown className={`h-3 w-3 ${partnerSort.key === 'trend' && partnerSort.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handlePartnerSort('lastUpdated')}
                        >
                          <div className="flex items-center gap-2">
                            Last Updated
                            <div className="flex flex-col">
                              <ChevronUp className={`h-3 w-3 ${partnerSort.key === 'lastUpdated' && partnerSort.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                              <ChevronDown className={`h-3 w-3 ${partnerSort.key === 'lastUpdated' && partnerSort.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                            </div>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getSortedPartners().map((partner) => (
                        <>
                          <tr 
                            key={partner.id} 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => togglePartnerExpansion(partner.id)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {partner.partnerName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                partner.category === 'MLB' ? 'bg-green-100 text-green-800' :
                                partner.category === 'NBA' ? 'bg-blue-100 text-blue-800' :
                                partner.category === 'B2B' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {partner.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{partner.mainContact}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`text-sm font-semibold ${
                                  partner.currentHealthScore >= 8 ? 'text-green-600' :
                                  partner.currentHealthScore >= 6 ? 'text-yellow-600' :
                                  partner.currentHealthScore >= 4 ? 'text-orange-600' :
                                  'text-red-600'
                                }`}>
                                  {partner.currentHealthScore}/10
                                </div>
                                <div className={`ml-2 w-16 h-2 rounded-full ${
                                  partner.currentHealthScore >= 8 ? 'bg-green-200' :
                                  partner.currentHealthScore >= 6 ? 'bg-yellow-200' :
                                  partner.currentHealthScore >= 4 ? 'bg-orange-200' :
                                  'bg-red-200'
                                }`}>
                                  <div 
                                    className={`h-2 rounded-full ${
                                      partner.currentHealthScore >= 8 ? 'bg-green-600' :
                                      partner.currentHealthScore >= 6 ? 'bg-yellow-600' :
                                      partner.currentHealthScore >= 4 ? 'bg-orange-600' :
                                      'bg-red-600'
                                    }`}
                                    style={{ width: `${partner.currentHealthScore * 10}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-lg">{partner.trend}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {partner.lastUpdated ? new Date(partner.lastUpdated).toLocaleDateString() : '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                {expandedPartners[partner.id] ? (
                                  <ChevronDown className="h-5 w-5 text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandedPartners[partner.id] && (
                            <tr key={`${partner.id}-details`} className="bg-gray-50">
                              <td colSpan="7" className="px-6 py-4">
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Key Updates</h4>
                                    <div className="text-sm text-gray-700 bg-white p-3 rounded border">
                                      {partner.keyUpdates || 'No recent updates'}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Current Hurdles</h4>
                                    <div className="text-sm text-gray-700 bg-white p-3 rounded border">
                                      {partner.currentHurdles || 'No current hurdles'}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Action Items</h4>
                                    <div className="text-sm text-gray-700 bg-white p-3 rounded border">
                                      {partner.actionItems || 'No action items'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
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
