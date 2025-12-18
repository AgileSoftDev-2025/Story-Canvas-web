// frontend/app/pages/user-stories/index.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { localStorageService } from "../../utils/localStorageService";
import type { LocalUserStory, LocalProject } from "../../utils/localStorageModels";
import { useAuth } from "../../context/AuthContext";
import { userStoryService, userStoryAPIService } from "../../services/userstoryservices";

export default function UserStoryPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user, isAuthenticated, token } = useAuth();

  const [userStories, setUserStories] = useState<LocalUserStory[]>([]);
  const [groupedStories, setGroupedStories] = useState<Record<string, LocalUserStory[]>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [project, setProject] = useState<LocalProject | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('');

  useEffect(() => {
    console.log('UserStoryPage initialized with projectId:', projectId);
    console.log('Authentication status:', isAuthenticated);
    console.log('User:', user);
    
    if (projectId) {
      loadProjectData();
      handleInitialLoad();
    } else {
      setError('Project ID is required');
      setLoading(false);
    }
  }, [projectId, isAuthenticated]);

  const handleInitialLoad = async () => {
    try {
      setLoading(true);
      
      // Check authentication status and get token
      const authToken = localStorage.getItem('access_token') || token;
      
      // Always try to load project from localStorage first
      let projectData = localStorageService.getProject(projectId!);
      
      if (isAuthenticated && authToken) {
        console.log('🔐 User is authenticated, checking database...');
        setSyncStatus('Checking database...');
        
        if (!projectData) {
          // Project not in localStorage, sync from database
          console.log('🔄 Project not in localStorage, syncing from database...');
          setSyncStatus('Syncing project from database...');
          
          const projectSyncResult = await userStoryAPIService.syncProjectFromDatabase(projectId!, authToken);
          
          if (projectSyncResult.success) {
            setSyncStatus('✅ Project synced from database');
            console.log('✅ Project synced from database');
            projectData = localStorageService.getProject(projectId!);
            setProject(projectData);
          } else {
            setSyncStatus(`⚠️ ${projectSyncResult.message}`);
            console.warn('⚠️ Project sync failed:', projectSyncResult.message);
          }
        }
        
        // Sync user stories
        console.log('🔄 Starting user stories sync...');
        setSyncStatus('Syncing user stories...');
        
        const syncResult = await userStoryService.syncUserStories(projectId!, authToken);
        
        if (syncResult.success) {
          setSyncStatus(syncResult.message);
          console.log('✅ Sync completed:', syncResult.message);
        } else {
          setSyncStatus(`⚠️ ${syncResult.message}`);
          console.warn('⚠️ Sync failed:', syncResult.message);
        }
      } else {
        console.log('🔓 User is not authenticated, using local data only');
        setSyncStatus('Offline mode - using local data');
      }
      
      // Load stories from localStorage
      loadUserStories();
      
    } catch (error) {
      console.error('Error during initial load:', error);
      setError('Failed to load user stories');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateStories = async () => {
  if (!projectId) {
    setError('Project ID is required');
    return;
  }

  setGenerating(true);
  setLoading(true);
  setError(null);
  setSuccess(null);

  const progressInterval = simulateProgress();

  try {
    // Get authentication token
    const authToken = localStorage.getItem('access_token') || token;
    
    if (isAuthenticated && authToken) {
      console.log('🔐 User authenticated, syncing project from database...');
      setSyncStatus('Syncing & Generating...');
      
      // Use the new method that syncs project first
      const result = await userStoryService.syncProjectAndGenerateStories(
        projectId, 
        authToken
      );
      
      console.log('📦 Generation result:', result);
      
      if (result.success) {
        const successMsg = `Successfully ${result.source === 'database' ? 'loaded' : 'generated'} ${result.count || 0} user stories!`;
        console.log(successMsg);
        setSuccess(successMsg);
        
        // Auto-sync to database if generated new stories
        if (result.source === 'database_generated') {
          console.log('📤 Auto-syncing new stories to database...');
          setSyncStatus('Syncing new stories to database...');
          
          // Tunggu sebentar untuk memastikan stories tersimpan di localStorage
          setTimeout(async () => {
            const syncResult = await userStoryAPIService.syncLocalToDatabase(projectId, authToken);
            if (syncResult.success) {
              setSyncStatus(`✅ Synced ${syncResult.syncedCount} stories to database`);
              console.log(`✅ Auto-synced ${syncResult.syncedCount} stories to database`);
              
              // Reload stories setelah sync
              setTimeout(() => {
                loadUserStories();
              }, 500);
            } else {
              setSyncStatus(`⚠️ ${syncResult.message}`);
            }
          }, 1000);
        }
        
        setProgress(100);
        setTimeout(() => {
          loadUserStories();
          setGenerating(false);
          setLoading(false);
        }, 500);
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } else {
      // Offline mode - use local project
      console.log('🔓 Offline mode, using local project...');
      setSyncStatus('Generating locally...');
      
      const projectData = localStorageService.getProject(projectId);
      if (!projectData) {
        throw new Error('Project not found in localStorage. Please login to sync from database.');
      }

      const result = await userStoryService.generateUserStoriesWithSync(
        projectId, 
        undefined, // No token for offline
        projectData
      );
      
      console.log('📦 Offline generation result:', result);
      
      if (result.success) {
        const successMsg = `Successfully generated ${result.count || 0} user stories offline!`;
        console.log(successMsg);
        setSuccess(successMsg);
        
        setProgress(100);
        setTimeout(() => {
          loadUserStories();
          setGenerating(false);
          setLoading(false);
        }, 500);
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    }

  } catch (err) {
    console.error('❌ Generation error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Generation failed';
    setError(`Failed to generate user stories: ${errorMessage}`);
    
    setGenerating(false);
    setLoading(false);
    setSyncStatus('❌ Generation failed');
  } finally {
    clearInterval(progressInterval);
  }
};

  const loadProjectData = () => {
    if (!projectId) {
      setError('Project ID is required');
      return;
    }

    const projectData = localStorageService.getProject(projectId);
    console.log('Project data from localStorage:', projectData);

    if (projectData) {
      setError(null);
      setProject(projectData);
    } else {
      setError('Project not found in localStorage');
    }
  };

  const loadUserStories = () => {
  if (!projectId) return;

  try {
    setError(null);
    const stories = localStorageService.getUserStoriesByProject(projectId);
    console.log('🔍 Loaded user stories from localStorage:', stories.length);
    console.log('📋 Stories details:', stories);
    
    if (stories.length === 0) {
      console.warn('⚠️ No stories found in localStorage!');
      console.log('📊 Checking localStorage directly...');
      
      // Debug: cek semua data di localStorage
      const allStories = localStorageService.getAllUserStories();
      console.log('📊 Total stories in localStorage:', allStories.length);
      
      if (allStories.length > 0) {
        console.log('📊 All stories:', allStories);
        const projectStories = allStories.filter(s => s.project_id === projectId);
        console.log(`📊 Stories for project ${projectId}:`, projectStories.length);
      }
    }
    
    setUserStories(stories);
    groupStoriesByRole(stories);
    setLastUpdated(new Date().toLocaleString());
  } catch (error) {
    console.error('Error loading user stories:', error);
    setError('Failed to load user stories.');
  }
};

  const groupStoriesByRole = (stories: LocalUserStory[]) => {
    const grouped: Record<string, LocalUserStory[]> = {};

    stories.forEach(story => {
      if (!grouped[story.role]) {
        grouped[story.role] = [];
      }
      grouped[story.role].push(story);
    });

    setGroupedStories(grouped);
  };

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 300);
    return interval;
  };

  const handleManualSync = async () => {
    if (!projectId) return;
    
    const authToken = localStorage.getItem('access_token') || token;
    if (!authToken) {
      setError('Please login to sync with database');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSyncStatus('Syncing...');
    
    try {
      console.log('🔄 Manual sync started...');
      const syncResult = await userStoryService.syncUserStories(projectId, authToken);
      
      if (syncResult.success) {
        setSuccess(syncResult.message);
        setSyncStatus(`✅ ${syncResult.message}`);
        loadUserStories(); // Reload after sync
      } else {
        setError(syncResult.message);
        setSyncStatus(`⚠️ ${syncResult.message}`);
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      setError('Sync failed');
      setSyncStatus('❌ Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (projectId) {
      navigate(`/wireframe-generated/${projectId}`);
    } else {
      navigate('/wireframe-generated');
    }
  };

  const getLastSyncTime = (): string | null => {
    if (!projectId) return null;
    return userStoryAPIService.getLastSyncTime(projectId);
  };

  const formatLastSyncTime = (time: string | null): string => {
    if (!time) return 'Never synced';
    try {
      return `Last sync: ${new Date(time).toLocaleString()}`;
    } catch (error) {
      return `Last sync: ${time}`;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4699DF] mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {generating
                ? (isAuthenticated ? 'Syncing project & generating user stories with AI...' : 'Generating user stories locally...')
                : 'Loading user stories...'
              }
            </p>

            {generating && (
              <div className="mt-4 w-64 mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {isAuthenticated ? 'Syncing & Generating...' : 'Generating...'}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-[#5561AA] to-[#4699DF] h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold md:text-5xl">User Stories</h1>
            {project && (
              <p className="text-xl text-gray-600 mt-2">{project.title}</p>
            )}
            {projectId && (
              <div className="mt-2 space-y-1">
                <p className="text-gray-600">
                  {userStories.length} stories for this project
                </p>
                {lastUpdated && (
                  <p className="text-sm text-gray-500">
                    Local update: {lastUpdated}
                  </p>
                )}
                {/* Display last sync time */}
                {isAuthenticated && (
                  <p className="text-xs">
                    <span className="text-gray-500">Database sync: </span>
                    <button 
                      onClick={handleManualSync}
                      className={`${syncStatus.includes('✅') ? 'text-green-600' : 
                                syncStatus.includes('⚠️') ? 'text-yellow-600' : 
                                syncStatus.includes('❌') ? 'text-red-600' : 'text-blue-500'
                              } hover:underline`}
                      disabled={loading}
                    >
                      {syncStatus || formatLastSyncTime(getLastSyncTime())}
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {isAuthenticated && userStories.length > 0 && (
              <button
                onClick={handleManualSync}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 text-sm"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Syncing...
                  </div>
                ) : '🔄 Sync with Database'}
              </button>
            )}
            
            <button
              onClick={handleAccept}
              className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-4 py-2 font-medium text-white shadow-sm hover:opacity-95"
            >
              Continue to Wireframes →
            </button>
          </div>
        </div>

        {/* Authentication Status */}
        <div className="mb-6">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isAuthenticated
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${isAuthenticated ? 'bg-green-500' : 'bg-blue-500'
              }`}></span>
            {isAuthenticated 
              ? `🟢 Online Mode (${user?.username}) - Database connected`
              : '🔵 Offline Mode - Local storage only'
            }
          </div>
          
          {/* Project Source Info */}
          {project && (
            <div className="mt-2 text-sm text-gray-600">
              <span className="flex items-center">
                {isAuthenticated 
                  ? `📊 Project loaded from: ${project.user_specific ? 'Database' : 'Local storage'}`
                  : '📊 Project loaded from: Local storage'
                }
              </span>
            </div>
          )}
          
          {/* Sync Status */}
          {syncStatus && (
            <div className={`mt-2 text-sm ${syncStatus.includes('✅') ? 'text-green-600' : 
                             syncStatus.includes('⚠️') ? 'text-yellow-600' : 
                             syncStatus.includes('❌') ? 'text-red-600' : 'text-gray-600'}`}>
              <span className="flex items-center">
                {syncStatus.includes('✅') ? '✅' : 
                 syncStatus.includes('⚠️') ? '⚠️' : 
                 syncStatus.includes('❌') ? '❌' : 'ℹ️'}
                <span className="ml-1">{syncStatus}</span>
              </span>
            </div>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700 dark:text-green-300">
                  {success}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Generate Button if no stories */}
        {userStories.length === 0 && (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl mb-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {isAuthenticated 
                ? "Ready to generate user stories from your database project!"
                : "No user stories found"
              }
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 mb-6">
              {isAuthenticated 
                ? `Project "${project?.title}" will be loaded from database and AI will generate user stories.`
                : "Get started by generating user stories locally. Login to sync with database."
              }
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleGenerateStories}
                disabled={generating}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#4699DF] hover:bg-[#3a7bbf] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4699DF]"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isAuthenticated ? 'Syncing & Generating...' : 'Generating...'}
                  </>
                ) : (
                  `🔮 ${isAuthenticated ? 'Sync & Generate from Database' : 'Generate Locally'}`
                )}
              </button>
              {isAuthenticated && (
                <button
                  onClick={handleManualSync}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  🔄 Sync Only
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stories Content */}
        {userStories.length > 0 && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                User Stories ({userStories.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateStories}
                  disabled={generating}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {generating ? 'Generating...' : '🔄 Regenerate'}
                </button>
                {isAuthenticated && (
                  <button
                    onClick={handleManualSync}
                    disabled={loading}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    {loading ? 'Syncing...' : '🔄 Sync'}
                  </button>
                )}
              </div>
            </div>

            {Object.entries(groupedStories).map(([role, stories]) => (
              <section key={role} className="mb-8">
                <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white capitalize border-b pb-2">
                  {role}s ({stories.length} stories)
                </h2>
                <div className="space-y-4">
                  {stories.map((story) => (
                    <div
                      key={story.story_id}
                      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex-1 mr-4">
                          {story.story_text}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-1 text-xs rounded-full ${story.priority === 'high'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : story.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                            {story.priority}
                          </span>
                          {story.generated_by_llm && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full dark:bg-purple-900 dark:text-purple-200">
                              🤖 AI
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300 mb-4">
                        <div>
                          <strong>Feature:</strong> {story.feature || 'Not specified'}
                        </div>
                        <div>
                          <strong>Story Points:</strong> {story.story_points}
                        </div>
                        <div>
                          <strong>Status:</strong>
                          <span className={`ml-1 capitalize ${story.status === 'approved' ? 'text-green-600' :
                            story.status === 'implemented' ? 'text-blue-600' : 'text-yellow-600'
                            }`}>
                            {story.status}
                          </span>
                        </div>
                        <div>
                          <strong>Source:</strong>
                          <span className="ml-1">
                            {story.generated_by_llm ? '🤖 AI Generated' : '✍️ Manual'}
                          </span>
                        </div>
                      </div>

                      {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                            Acceptance Criteria:
                          </h4>
                          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                            {story.acceptance_criteria.map((criterion, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-green-500 mr-2 mt-1">•</span>
                                <span>{criterion}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Created: {new Date(story.created_at).toLocaleDateString()}
                          {story.updated_at !== story.created_at &&
                            ` • Updated: ${new Date(story.updated_at).toLocaleDateString()}`
                          }
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {story.story_id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Continue Button at Bottom */}
        {userStories.length > 0 && (
          <div className="flex justify-center mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleAccept}
              className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-8 py-3 font-medium text-white shadow-sm hover:opacity-95 text-lg flex items-center"
            >
              Continue to Wireframes
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}