// pages/index.js - Updated Dashboard with time-normalized at-risk calculation
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Target, TrendingUp, AlertCircle, CheckCircle, Clock, LogOut } from 'lucide-react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) {
      router.push('/login');
      return;
    }
    fetchGoals();
  }, [session, status, router]);

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
    // Goal is at risk if it's more than 15 percentage points behind where it should be
    // based on time elapsed in the quarter
    const expectedProgress = quarterProgress;
    const threshold = 15; // percentage points
    return (expectedProgress - completion) > threshold;
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
    // Create consistent colors for different focus areas
    const focusColors = {
      'MLB Teams': 'text-blue-600 bg-blue-50',
      'NBA Teams': 'text-purple-600 bg-purple-50',
      'NBA Growth': 'text-purple-600 bg-purple-50',
      'Product': 'text-green-600 bg-green-50',
      'Infrastructure': 'text-orange-600 bg-orange-50',
      'Business Development': 'text-indigo-600 bg-indigo-50',
      'Customer Success': 'text-teal-600 bg-teal-50',
      'Security': 'text-red-600 bg-red-50',
      'Engineering': 'text-cyan-600 bg-cyan-50',
      'General': 'text-gray-600 bg-gray-50'
    };

    // Handle multiple focuses (comma separated)
    if (focus.includes(',')) {
      return 'text-gray-600 bg-gray-50'; // Default for multiple focuses
    }

    return focusColors[focus] || 'text-gray-600 bg-gray-50';
  };

  const getCompletionColor = (completion) => {
    if (completion >= 80) return 'bg-green-500';
    if (completion >= 60) return 'bg-blue-500';
    if (completion >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
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
              <p className="text-gray-600">{currentQuarter} 2025 Goals & Progress Dashboard</p>
              <p className="text-sm text-gray-500">
                {Math.round(quarterProgress)}% through {currentQuarter} • Expected progress: {Math.round(quarterProgress)}%
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{overallProgress}%</div>
                <div className="text-sm text-gray-500">{currentQuarter} Progress</div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Welcome, {session.user.name}</span>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
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
                            <h3 className="text-lg font-medium text-gray-900">{goal.title}</h3>
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
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Key Results:</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line">{goal.keyResults}</div>
                            </div>
                          )}
                          {goal.completedKRs && (
                            <div>
                              <h4 className="text-sm font-medium text-green-700 mb-2">Completed KRs:</h4>
                              <div className="text-sm text-green-600 whitespace-pre-line">{goal.completedKRs}</div>
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
        )}
      </div>
    </div>
  );
}
