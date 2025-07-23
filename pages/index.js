import { useState, useEffect } from 'react';
import { Calendar, Target, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function Dashboard() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGoals();
  }, []);

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

  const getCompletionColor = (completion) => {
    if (completion >= 80) return 'bg-green-500';
    if (completion >= 60) return 'bg-blue-500';
    if (completion >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const prioritizedGoals = goals.filter(goal => 
    goal.quarter !== 'Not Prioritized' && goal.quarter !== 'Backlog'
  );

  const overallProgress = prioritizedGoals.length > 0 
    ? Math.round(prioritizedGoals.reduce((sum, goal) => sum + goal.completion, 0) / prioritizedGoals.length)
    : 0;

  const goalsAtRisk = goals.filter(goal => {
    const daysUntilDue = getDaysUntilDue(goal.dueDate);
    return daysUntilDue < 30 && goal.completion < 70;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reboot OS Control Tower</h1>
              <p className="text-gray-600">Current Goals & Progress Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{overallProgress}%</div>
                <div className="text-sm text-gray-500">Overall Progress</div>
              </div>
              <button
                onClick={fetchGoals}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Refresh
              </button>
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
                    <p className="text-sm font-medium text-gray-600">Active Goals</p>
                    <p className="text-2xl font-bold text-gray-900">{prioritizedGoals.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {prioritizedGoals.filter(g => g.completion >= 100).length}
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
              <h2 className="text-lg font-semibold text-gray-900">Current Goals</h2>
              
              {prioritizedGoals.map((goal) => {
                const daysUntilDue = getDaysUntilDue(goal.dueDate);
                const isAtRisk = daysUntilDue < 30 && goal.completion < 70;
                
                return (
                  <div key={goal.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">{goal.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(goal.status)}`}>
                            {goal.status}
                          </span>
                          {isAtRisk && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              At Risk
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Owner: {goal.owner}</span>
                          <span>Focus: {goal.focus}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Due: {new Date(goal.dueDate).toLocaleDateString()}
                          </span>
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
                            <h4 className="text-sm font-medium text-green-700 mb-2">Completed Key Results:</h4>
                            <div className="text-sm text-green-600 whitespace-pre-line">{goal.completedKRs}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
