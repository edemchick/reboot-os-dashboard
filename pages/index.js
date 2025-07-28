// pages/index.js - Updated Dashboard with time-normalized at-risk calculation
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Target, TrendingUp, AlertCircle, CheckCircle, Clock, LogOut, Settings, ChevronDown } from 'lucide-react';

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

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) {
      router.push('/login');
      return;
    }
    fetchGoals();
  }, [session, status, router]);

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
  const getQuarterInfo = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed
    const day = now.getDate();
    
    let quarter, startDate, endDate;
    
    if ((month === 1 && day >= 11) || month === 2 || month === 3 || (month === 4 && day <= 10)) {
      quarter = 'Q1';
      startDate = new Date(year, 0, 11); // Jan 11
      endDate = new Date(year, 3, 10); // Apr 10
    } else if ((month === 4 && day >= 11) || month === 5 || month === 6 || (month === 7 && day <= 10)) {
      quarter = 'Q2';
      startDate = new Date(year, 3, 11); // Apr 11
      endDate = new Date(year, 6, 10); // Jul 10
    } else if ((month === 7 && day >= 11) || month === 8 || month === 9 || (month === 10 && day <= 10)) {
      quarter = 'Q3';
      startDate = new Date(year, 6, 11); // Jul 11
      endDate = new Date(year, 9, 10); // Oct 10
    } else {
      quarter = 'Q4';
      if (month >= 10) {
        startDate = new Date(year, 9, 11); // Oct 11
        endDate = new Date(year + 1, 0, 10); // Jan 10 next year
      } else {
        // We're in Jan 1-10 of the following year
        startDate = new Date(year - 1, 9, 11); // Oct 11 previous year
        endDate = new Date(year, 0, 10); // Jan 10 current year
      }
    }
    
    // Calculate progress through the quarter (0-1)
    const totalQuarterDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const quarterProgress = Math.max(0, Math.min(1, daysSinceStart / totalQuarterDays));
    
    return { quarter, quarterProgress: quarterProgress * 100 };
  };

  // Function to determine if a goal is at risk based on time-normalized progress
  const isGoalAtRisk = (completion, quarterProgress) => {
    // Goal is at risk if completion percentage is less than quarter progress percentage
    return completion < quarterProgress;
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
                      <span className="font-medium">Progress:</span> {item.progress}
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

  const { quarter: currentQuarter, quarterProgress } = getQuarterInfo();
  
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

  const goalsAtRisk = currentGoals.filter(goal => isGoalAtRisk(goal.completion, quarterProgress));

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
                  const atRisk = isGoalAtRisk(goal.completion, quarterProgress);
                  
                  return (
                    <div key={goal.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                            <div>
                              <h4 className="text-sm font-medium text-green-700 mb-2">Completed KRs:</h4>
                              <div 
                                className="text-sm text-green-600 whitespace-pre-line"
                                dangerouslySetInnerHTML={{ __html: goal.completedKRs }}
                              ></div>
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
        ) : (
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
        )}
      </div>
    </div>
  );
}
