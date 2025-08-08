import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { ArrowLeft, Users, AlertCircle, ChevronDown, ChevronRight, Calendar, Star, Target, TrendingUp, Edit, Save, X } from 'lucide-react';

export default function PeopleAnalyzer() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPeople, setExpandedPeople] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

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

      fetchPeople();
    };

    checkAdminAndFetch();
  }, [session, status, router]);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/people');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch people data');
      }
      
      const data = await response.json();
      setPeople(data);
    } catch (error) {
      console.error('Error fetching people:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePersonExpansion = (personId) => {
    setExpandedPeople(prev => ({
      ...prev,
      [personId]: !prev[personId]
    }));
  };

  const openEditModal = (person) => {
    setEditingPerson(person);
    setEditForm({
      primaryRole: person.primaryRole || '',
      capacity: person.capacity || '',
      competency: person.competency || '',
      desire: person.desire || '',
      secondaryRole: person.secondaryRole || '',
      capacity2: person.capacity2 || '',
      competency2: person.competency2 || '',
      desire2: person.desire2 || '',
      discussion: person.discussion || ''
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingPerson(null);
    setEditForm({});
    setSaving(false);
  };

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveChanges = async () => {
    if (!editingPerson) return;
    
    try {
      setSaving(true);
      
      const response = await fetch(`/api/people/${editingPerson.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes');
      }
      
      // Refresh the people data to show updated information
      await fetchPeople();
      
      // Close the modal
      closeEditModal();
    } catch (error) {
      console.error('Error saving changes:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    // No coloring for status - just return neutral styling
    return 'text-gray-900';
  };

  const getCapacityColor = (rating) => {
    switch (rating?.trim()) {
      case '+': return 'bg-green-100 text-green-800 border-green-300';
      case '?': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case '-': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCompetencyColor = (rating) => {
    switch (rating?.trim()) {
      case '+': return 'bg-green-100 text-green-800 border-green-300';
      case '?': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case '-': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getDesireColor = (rating) => {
    switch (rating?.trim()) {
      case '+': return 'bg-green-100 text-green-800 border-green-300';
      case '?': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case '-': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCoreValuesColor = (coreValues) => {
    if (coreValues === '+ + +') {
      return 'bg-green-100 text-green-800 border border-green-300';
    } else if (coreValues && coreValues.includes('?')) {
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    } else if (coreValues && coreValues.includes('-')) {
      return 'bg-red-100 text-red-800 border border-red-300';
    } else {
      return 'bg-gray-100 text-gray-700 border border-gray-300';
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
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-red-600" />
              <h1 className="text-xl font-semibold text-gray-900">People Analyzer</h1>
              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                Admin Only
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">People Analyzer</h2>
              <p className="text-gray-600 mt-1">Do we have the right people in the right seats?</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                {people.length} Team Members
              </div>
            </div>
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
              <p className="text-red-600 text-sm mt-2">
                Check your NOTION_PEOPLE_DATABASE_ID environment variable and database sharing settings.
              </p>
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No team members found</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Team Member
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Core Values
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {people.map((person) => (
                      <>
                        <tr 
                          key={person.id} 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => togglePersonExpansion(person.id)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {person.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{person.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${getStatusColor(person.status)}`}>
                              {person.status}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCoreValuesColor(person.coreValues)}`}>
                              {person.coreValues || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center">
                              {expandedPeople[person.id] ? (
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedPeople[person.id] && (
                          <tr key={`${person.id}-details`} className="bg-gray-50">
                            <td colSpan="5" className="px-6 py-4">
                              <div className="space-y-4">
                                {/* Show both sections if secondary role has text, otherwise just primary */}
                                {person.secondaryRole && person.secondaryRole.trim() ? (
                                  /* Two column layout with secondary role */
                                  <>
                                    <div className="flex justify-end mb-4">
                                      <button
                                        onClick={() => openEditModal(person)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                      >
                                        <Edit className="h-3 w-3" />
                                        Edit
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                          <Target className="h-4 w-4 text-blue-600" />
                                          Primary Role Analysis
                                        </h4>
                                        <div className="space-y-2 text-sm text-gray-700 bg-white p-3 rounded border">
                                          <div><strong>Primary Role:</strong> {person.primaryRole || 'Not assigned'}</div>
                                          <div className="flex items-center gap-2">
                                            <strong>Capacity:</strong> 
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getCapacityColor(person.capacity)}`}>
                                              {person.capacity || '-'}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <strong>Competency:</strong>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getCompetencyColor(person.competency)}`}>
                                              {person.competency || '-'}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <strong>Desire:</strong>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getDesireColor(person.desire)}`}>
                                              {person.desire || '-'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                          <TrendingUp className="h-4 w-4 text-green-600" />
                                          Secondary Role Analysis
                                        </h4>
                                        <div className="space-y-2 text-sm text-gray-700 bg-white p-3 rounded border">
                                          <div><strong>Secondary Role:</strong> {person.secondaryRole}</div>
                                          <div className="flex items-center gap-2">
                                            <strong>Capacity:</strong> 
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getCapacityColor(person.capacity2)}`}>
                                              {person.capacity2 || '-'}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <strong>Competency:</strong>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getCompetencyColor(person.competency2)}`}>
                                              {person.competency2 || '-'}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <strong>Desire:</strong>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getDesireColor(person.desire2)}`}>
                                              {person.desire2 || '-'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  /* Single column layout - no secondary role */
                                  <>
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                        <Target className="h-4 w-4 text-blue-600" />
                                        Primary Role Analysis
                                      </h4>
                                      <button
                                        onClick={() => openEditModal(person)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                      >
                                        <Edit className="h-3 w-3" />
                                        Edit
                                      </button>
                                    </div>
                                    <div className="max-w-md">
                                      <div className="space-y-2 text-sm text-gray-700 bg-white p-3 rounded border">
                                        <div><strong>Primary Role:</strong> {person.primaryRole || 'Not assigned'}</div>
                                        <div className="flex items-center gap-2">
                                          <strong>Capacity:</strong> 
                                          <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getCapacityColor(person.capacity)}`}>
                                            {person.capacity || '-'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <strong>Competency:</strong>
                                          <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getCompetencyColor(person.competency)}`}>
                                            {person.competency || '-'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <strong>Desire:</strong>
                                          <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getDesireColor(person.desire)}`}>
                                            {person.desire || '-'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                                
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                      <Star className="h-4 w-4 text-purple-600" />
                                      Discussion Notes
                                    </h4>
                                    <button
                                      onClick={() => openEditModal(person)}
                                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                    >
                                      <Edit className="h-3 w-3" />
                                      Edit
                                    </button>
                                  </div>
                                  <div className="text-sm text-gray-700 bg-white p-3 rounded border min-h-[80px]">
                                    {person.discussion || 'No discussion notes'}
                                  </div>
                                  {(person.updatedBy || person.lastUpdated) && (
                                    <div className="text-xs text-gray-500 mt-2">
                                      Last updated{person.updatedBy && ` by ${person.updatedBy}`}{person.lastUpdated && ` on ${new Date(person.lastUpdated).toLocaleString()}`}
                                    </div>
                                  )}
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
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit: {editingPerson?.name}
                </h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Primary Role Section */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  Primary Role Analysis
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Role
                    </label>
                    <input
                      type="text"
                      value={editForm.primaryRole}
                      onChange={(e) => handleFormChange('primaryRole', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter primary role"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Capacity
                      </label>
                      <select
                        value={editForm.capacity}
                        onChange={(e) => handleFormChange('capacity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="+">+</option>
                        <option value="?">?</option>
                        <option value="-">-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Competency
                      </label>
                      <select
                        value={editForm.competency}
                        onChange={(e) => handleFormChange('competency', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="+">+</option>
                        <option value="?">?</option>
                        <option value="-">-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Desire
                      </label>
                      <select
                        value={editForm.desire}
                        onChange={(e) => handleFormChange('desire', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="+">+</option>
                        <option value="?">?</option>
                        <option value="-">-</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Role Section */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Secondary Role Analysis
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Role
                    </label>
                    <input
                      type="text"
                      value={editForm.secondaryRole}
                      onChange={(e) => handleFormChange('secondaryRole', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter secondary role (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Capacity
                      </label>
                      <select
                        value={editForm.capacity2}
                        onChange={(e) => handleFormChange('capacity2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="+">+</option>
                        <option value="?">?</option>
                        <option value="-">-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Competency
                      </label>
                      <select
                        value={editForm.competency2}
                        onChange={(e) => handleFormChange('competency2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="+">+</option>
                        <option value="?">?</option>
                        <option value="-">-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Desire
                      </label>
                      <select
                        value={editForm.desire2}
                        onChange={(e) => handleFormChange('desire2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="+">+</option>
                        <option value="?">?</option>
                        <option value="-">-</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Discussion Notes */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-purple-600" />
                  Discussion Notes
                </h4>
                <textarea
                  value={editForm.discussion}
                  onChange={(e) => handleFormChange('discussion', e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter discussion notes..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={closeEditModal}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}