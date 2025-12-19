// app/pages/HasilGenerate.tsx - FIXED WITH LOCAL API
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate, useParams } from "react-router-dom";
import { localStorageService } from "../../utils/localStorageService";
import type { 
  LocalProject, 
  LocalUserStory, 
  LocalWireframe, 
  LocalScenario
} from "../../utils/localStorageModels";
import { useAuth } from "../../context/AuthContext";
import { scenarioSyncService } from "../../services/ScenarioSyncService";

// Import the ScenarioService from the correct path
import { ScenarioService } from "../../services/scenarioServices";

// Constants - USING LOCAL API
const API_URL = "http://127.0.0.1:5173/api/local-projects/generate-scenarios/";

// Define all possible scenario types including boundary_path
type ScenarioType = 
  | 'happy_path' 
  | 'alternate_path' 
  | 'exception_path' 
  | 'boundary_case' 
  | 'boundary_path' 
  | 'other';

export default function HasilGenerate() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user, isAuthenticated } = useAuth();
  
  const [scenarios, setScenarios] = useState<LocalScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<{
    is_synced: boolean;
    database: { scenario_count: number; last_updated: string | null };
    local: { scenario_count: number; last_updated: string | null };
    needs_sync: boolean;
    mode?: string;
  } | null>(null);
  
  const [projectTitle, setProjectTitle] = useState("");
  const [userStories, setUserStories] = useState<LocalUserStory[]>([]);
  const [wireframes, setWireframes] = useState<LocalWireframe[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Create instance of ScenarioService
  const scenarioService = ScenarioService.getInstance();

  // Clean up duplicate keys on mount
  useEffect(() => {
    cleanupDuplicateScenarioKeys();
  }, []);

  // Load project data with auto-sync
  useEffect(() => { 
    if (projectId) {
      loadProjectAndGenerateScenariosWithSync();
    } else {
      setError("No project ID provided");
      setLoading(false);
    }
  }, [projectId, isAuthenticated]);

  // Clean duplicate scenario keys from localStorage
  const cleanupDuplicateScenarioKeys = () => {
    const keysToRemove: string[] = [];
    
    Object.keys(localStorage).forEach(key => {
      // Remove all scenario keys that are not 'local_scenarios'
      if (key.startsWith('scenarios_') || 
          key.startsWith('Scenarios_') || 
          (key.includes('scenario') && key !== 'local_scenarios')) {
        keysToRemove.push(key);
      }
    });
    
    if (keysToRemove.length > 0) {
      console.log("🧹 Cleaning up duplicate scenario keys:", keysToRemove);
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  };

  // Debug function to check localStorage
  const debugLocalStorage = () => {
    console.log("🔍 Debug localStorage:");
    Object.keys(localStorage).forEach(key => {
      if (key.includes('scenario') || key.includes('Scenario')) {
        try {
          const value = localStorage.getItem(key);
          const parsed = value ? JSON.parse(value) : null;
          console.log(`📦 ${key}:`, Array.isArray(parsed) ? `${parsed.length} items` : typeof parsed);
        } catch (e) {
          console.log(`📦 ${key}: Invalid JSON`);
        }
      }
    });
  };

  // Main function to load project with auto-sync - FIXED TO USE LOCAL API
  const loadProjectAndGenerateScenariosWithSync = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setSyncStatus(null);

      if (!projectId) {
        setError("No project ID provided");
        setLoading(false);
        return;
      }

      console.log("🔍 Loading project data with auto-sync...");
      debugLocalStorage();
      
      const authToken = localStorage.getItem('access_token');
      
      // STEP 1: Load basic project data
      const projectData = localStorageService.getProject(projectId);
      
      if (!projectData) {
        setError("Project not found in local storage");
        setLoading(false);
        return;
      }

      const stories = localStorageService.getUserStoriesByProject(projectId);
      const wireframesData = localStorageService.getWireframesByProject(projectId);

      // Ensure domain exists
      if (!projectData.domain) {
        localStorageService.updateProject(projectId, {
          ...projectData,
          domain: "waste_management"
        });
      }

      setProjectTitle(projectData.title || "Local Project");
      setUserStories(stories);
      setWireframes(wireframesData);

      // Validate we have user stories and wireframes
      if (stories.length === 0) {
        setError("No user stories found. Please generate user stories first.");
        setLoading(false);
        return;
      }

      if (wireframesData.length === 0) {
        setError("No wireframes found. Please generate wireframes first.");
        setLoading(false);
        return;
      }

      // STEP 2: Perform auto-sync if authenticated
      if (isAuthenticated && authToken) {
        console.log('🔐 User is authenticated, performing auto-sync for scenarios...');
        setSyncStatus('Auto-syncing scenarios...');
        
        try {
          const autoSyncResult = await scenarioService.autoSyncOnEntry(projectId, authToken);
          
          if (autoSyncResult.success) {
            setSyncStatus(autoSyncResult.message);
            console.log('✅ Auto-sync completed:', autoSyncResult.message);
            
            if (autoSyncResult.syncedFromDb && autoSyncResult.scenarioCount && autoSyncResult.scenarioCount > 0) {
              setSuccess(autoSyncResult.message);
            }
          } else {
            setSyncStatus(`⚠️ ${autoSyncResult.message}`);
            console.warn('⚠️ Auto-sync failed:', autoSyncResult.message);
          }
        } catch (syncError) {
          console.error('Auto-sync error:', syncError);
          setSyncStatus('⚠️ Auto-sync failed, using local data');
        }
      } else {
        console.log('🔓 User is not authenticated, using local data only');
        setSyncStatus('Offline mode - using local data');
      }

      // STEP 3: Load scenarios (either synced from DB or local)
      let scenariosData: LocalScenario[] = [];
      
      try {
        // Get scenarios from localStorage (could be fresh from sync)
        const allScenariosRaw = localStorage.getItem('local_scenarios');
        const allScenarios = allScenariosRaw ? JSON.parse(allScenariosRaw) : [];
        scenariosData = allScenarios.filter((s: LocalScenario) => s.project_id === projectId);

        console.log("📦 Scenarios loaded:", {
          fromStorage: allScenarios.length,
          forProject: scenariosData.length,
          projectId
        });

        if (scenariosData.length === 0) {
          console.log("🚀 No scenarios found, generating via local API...");
          // Use local API for scenario generation instead of auto-generation
          await generateScenariosViaLocalAPI(projectId, projectData, stories, wireframesData);
        } else {
          console.log("✅ Using existing scenarios from localStorage:", scenariosData.length);
          setScenarios(scenariosData);
          setHasGenerated(true);
        }

      } catch (generationError) {
        console.error("❌ Error in scenario generation/loading:", generationError);
        
        // Try fallback generation via local API
        if (generationError instanceof Error && 
            (generationError.message.includes('No user stories') || 
             generationError.message.includes('No wireframes'))) {
          setError(generationError.message);
        } else {
          await generateFallbackScenariosViaAPI(stories);
        }
      }

      // STEP 4: Update sync info
      updateSyncInfo(projectId, authToken);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load project data';
      console.error("💥 Load Error:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Generate scenarios via local API - FIXED: Don't clear existing scenarios
  const generateScenariosViaLocalAPI = async (
    projectId: string, 
    projectData: LocalProject,
    stories: LocalUserStory[],
    wireframesData: LocalWireframe[]
  ): Promise<void> => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);
      
      console.log('🚀 Generating scenarios via local API...');
      setSyncStatus('Generating scenarios via local API...');

      // Prepare data for API call
      const apiProjectData = {
        title: projectData.title,
        objective: projectData.objective || '',
        users: Array.isArray(projectData.users_data) ? projectData.users_data : [],
        features: Array.isArray(projectData.features_data) ? projectData.features_data : [],
        scope: projectData.scope || '',
        flow: projectData.flow || '',
        additional_info: projectData.additional_info || '',
        domain: projectData.domain || 'general'
      };

      const apiUserStories = stories.slice(0, 3).map(story => ({
        story_id: story.story_id,
        story_text: story.story_text,
        role: story.role,
        action: story.action,
        benefit: story.benefit,
        feature: story.feature,
        acceptance_criteria: story.acceptance_criteria,
        priority: story.priority,
        story_points: story.story_points,
        status: story.status
      }));

      const apiWireframes = wireframesData.slice(0, 2).map(wf => ({
        wireframe_id: wf.wireframe_id,
        page_name: wf.page_name,
        html_content: wf.html_content || '',
        page_type: wf.page_type || 'general'
      }));

      console.log('📤 Sending request to local API:', {
        url: API_URL,
        project_id: projectId,
        user_stories_count: apiUserStories.length,
        wireframes_count: apiWireframes.length
      });

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          project_data: apiProjectData,
          user_stories: apiUserStories,
          wireframes: apiWireframes
        })
      });

      console.log('📥 Local API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Local API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Local API Response data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Scenario generation failed on server');
      }

      // Save scenarios to localStorage WITHOUT clearing existing ones
      if (data.scenarios && Array.isArray(data.scenarios)) {
        const savedScenarios: LocalScenario[] = [];
        
        // Get existing scenarios to check for duplicates
        const existingScenarios = localStorageService.getScenariosByProject(projectId);
        const existingIds = new Set(existingScenarios.map(s => s.scenario_id));
        
        console.log(`📊 Existing scenarios: ${existingScenarios.length}, New scenarios from API: ${data.scenarios.length}`);

        // Save new scenarios (skip if already exists)
        data.scenarios.forEach((apiScenario: any) => {
          try {
            // Check if scenario already exists
            if (existingIds.has(apiScenario.scenario_id)) {
              console.log(`ℹ️ Scenario ${apiScenario.scenario_id} already exists, skipping...`);
              return;
            }
            
            const scenarioInput: Omit<LocalScenario, 'scenario_id' | 'created_at' | 'updated_at'> = {
              project_id: projectId,
              user_story_id: apiScenario.user_story_id || null,
              scenario_text: apiScenario.scenario_text || '',
              scenario_type: apiScenario.scenario_type || 'happy_path',
              title: apiScenario.title || 'Scenario',
              detected_domain: apiScenario.detected_domain || 'general',
              has_proper_structure: apiScenario.has_proper_structure || true,
              gherkin_steps: apiScenario.gherkin_steps || [],
              enhanced_with_llm: apiScenario.enhanced_with_llm || false,
              status: apiScenario.status || 'draft',
            };

            const savedScenario = localStorageService.createScenario(scenarioInput, apiScenario.scenario_id);
            savedScenarios.push(savedScenario);
          } catch (err) {
            console.error('Error saving scenario:', err);
          }
        });

        // Combine existing and new scenarios
        const allScenariosForProject = [...existingScenarios, ...savedScenarios];
        
        setScenarios(allScenariosForProject);
        setHasGenerated(true);
        setSuccess(`Generated ${savedScenarios.length} new scenarios via local API (Total: ${allScenariosForProject.length})`);
        setSyncStatus('✅ Scenarios generated successfully');
        
        console.log(`✅ Saved ${savedScenarios.length} new scenarios to localStorage (Total: ${allScenariosForProject.length})`);
      } else {
        throw new Error('No scenarios returned from API');
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate scenarios via local API';
      console.error("❌ Local API Generation Error:", err);
      setError(errorMessage);
      setSyncStatus('❌ Failed to generate scenarios');
      
      // Fallback to template-based generation
      await generateTemplateScenarios(stories);
    } finally {
      setGenerating(false);
    }
  };

  // NEW: Generate template-based scenarios as fallback
  const generateTemplateScenarios = async (storiesData: LocalUserStory[]): Promise<void> => {
    console.log("🔄 Creating template-based scenarios as fallback...");
    
    try {
      if (!projectId) return;
      
      const projectData = localStorageService.getProject(projectId);
      if (!projectData) {
        setError("Project not found");
        return;
      }

      const scenarios: LocalScenario[] = [];
      
      // Limit to 3 user stories for performance
      storiesData.slice(0, 3).forEach((story, storyIndex) => {
        const role = story.role || 'User';
        const action = story.action || 'use system';
        const benefit = story.benefit || 'achieve goal';
        const feature = story.feature || 'General';

        // Create different scenario types
        const scenarioTypes = [
          {
            type: 'happy_path' as const,
            text: `${role} successfully ${action} and ${benefit}`,
            title: `Successful ${action}`,
            steps: [
              `Given ${role} wants to ${action}`,
              `When they follow the correct procedure`,
              `Then the system should process the request successfully`,
              `And ${benefit}`
            ]
          },
          {
            type: 'alternate_path' as const,
            text: `${role} ${action} using an alternative method and ${benefit}`,
            title: `Alternative ${action}`,
            steps: [
              `Given ${role} needs to ${action}`,
              `When they choose an alternative method`,
              `Then the system should accommodate the variation`,
              `And ${benefit}`
            ]
          },
          {
            type: 'exception_path' as const,
            text: `${role} encounters an error while trying to ${action}`,
            title: `Error in ${action}`,
            steps: [
              `Given ${role} attempts to ${action}`,
              `When they provide invalid or missing data`,
              `Then the system should display appropriate error messages`,
              `And guide them to correct the input`
            ]
          }
        ];

        scenarioTypes.forEach((scenarioType, typeIndex) => {
          const scenarioId = `template_${projectId}_${story.story_id}_${scenarioType.type}_${Date.now()}_${storyIndex}_${typeIndex}`;
          
          const scenarioInput: Omit<LocalScenario, 'scenario_id' | 'created_at' | 'updated_at'> = {
            project_id: projectId,
            user_story_id: story.story_id,
            scenario_text: scenarioType.text,
            scenario_type: scenarioType.type,
            title: scenarioType.title,
            detected_domain: projectData.domain || 'general',
            has_proper_structure: true,
            gherkin_steps: scenarioType.steps,
            enhanced_with_llm: false,
            status: 'draft',
          };

          const savedScenario = localStorageService.createScenario(scenarioInput, scenarioId);
          scenarios.push(savedScenario);
        });
      });

      // Get existing scenarios and combine with new ones
      const existingScenarios = localStorageService.getScenariosByProject(projectId);
      const allScenarios = [...existingScenarios, ...scenarios];
      
      setScenarios(allScenarios);
      setHasGenerated(true);
      setSuccess(`Generated ${scenarios.length} template scenarios as fallback (Total: ${allScenarios.length})`);
      setSyncStatus('✅ Used template-based scenarios');
      
      console.log(`✅ Generated ${scenarios.length} template scenarios (Total: ${allScenarios.length})`);

    } catch (error) {
      console.error("❌ Error creating template scenarios:", error);
      setError("Failed to generate template scenarios");
    }
  };

  // UPDATED: Fallback scenarios using local API
  const generateFallbackScenariosViaAPI = async (storiesData: LocalUserStory[]): Promise<void> => {
    console.log("🔄 Creating fallback scenarios via local API...");
    
    try {
      if (!projectId) return;
      
      const projectData = localStorageService.getProject(projectId);
      if (!projectData) {
        setError("Project not found");
        return;
      }

      const wireframesData = localStorageService.getWireframesByProject(projectId);
      
      // Try local API first
      await generateScenariosViaLocalAPI(projectId, projectData, storiesData, wireframesData);
      
    } catch (error) {
      console.error("❌ Local API fallback failed:", error);
      // If API fails, use template generation
      await generateTemplateScenarios(storiesData);
    }
  };

  const updateSyncInfo = async (projectId: string, token?: string | null) => {
    try {
      const syncStatusResult = await scenarioService.getScenarioSyncStatus(projectId, token);
      
      if (syncStatusResult.success && syncStatusResult.sync_status) {
        setSyncInfo(syncStatusResult.sync_status);
      } else {
        const localScenarios = localStorageService.getScenariosByProject(projectId);
        setSyncInfo({
          is_synced: false,
          database: { scenario_count: 0, last_updated: null },
          local: { 
            scenario_count: localScenarios.length,
            last_updated: localScenarios.length > 0 
              ? new Date(Math.max(...localScenarios.map(s => new Date(s.updated_at || s.created_at).getTime()))).toISOString()
              : null
          },
          needs_sync: false,
          mode: token ? 'error' : 'offline'
        });
      }
    } catch (error) {
      console.error('Error updating sync info:', error);
    }
  };

  // Manual sync handlers
  const handleManualSync = async () => {
    if (!projectId) return;
    
    const authToken = localStorage.getItem('access_token');
    if (!authToken) {
      setError('Please login to sync with database');
      return;
    }
    
    setSyncLoading(true);
    setError(null);
    setSyncStatus('Syncing...');
    
    try {
      console.log('🔄 Manual scenario sync started...');
      const syncResult = await scenarioService.twoWaySyncScenarios(projectId, authToken);
      
      if (syncResult.success) {
        setSuccess(`✅ ${syncResult.message}`);
        setSyncStatus(`✅ ${syncResult.message}`);
        
        // Update scenarios after sync
        await reloadScenarios();
        await updateSyncInfo(projectId, authToken);
      } else {
        setError(`⚠️ ${syncResult.message}`);
        setSyncStatus(`⚠️ ${syncResult.message}`);
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      setError('Sync failed');
      setSyncStatus('❌ Sync failed');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleForceSyncFromDatabase = async () => {
    if (!projectId) return;
    
    const authToken = localStorage.getItem('access_token');
    if (!authToken) {
      setError('Please login to sync with database');
      return;
    }
    
    setSyncLoading(true);
    setError(null);
    setSyncStatus('Syncing from database...');
    
    try {
      console.log('🔄 Force syncing scenarios from database...');
      const syncResult = await scenarioSyncService.syncDatabaseToLocalStorage(projectId, authToken);
      
      if (syncResult.success) {
        setSuccess(`✅ ${syncResult.message}`);
        setSyncStatus(`✅ ${syncResult.message}`);
        await reloadScenarios();
        await updateSyncInfo(projectId, authToken);
      } else {
        setError(`⚠️ ${syncResult.message}`);
        setSyncStatus(`⚠️ ${syncResult.message}`);
      }
    } catch (error) {
      console.error('Force sync failed:', error);
      setError('Force sync failed');
      setSyncStatus('❌ Sync failed');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncToDatabase = async () => {
    if (!projectId) return;
    
    const authToken = localStorage.getItem('access_token');
    if (!authToken) {
      setError('Please login to sync with database');
      return;
    }
    
    setSyncLoading(true);
    setError(null);
    setSyncStatus('Syncing to database...');
    
    try {
      console.log('🔄 Syncing local scenarios to database...');
      const syncResult = await scenarioSyncService.syncLocalToDatabase(projectId, authToken);
      
      if (syncResult.success) {
        setSuccess(`✅ ${syncResult.message}`);
        setSyncStatus(`✅ ${syncResult.message}`);
        await updateSyncInfo(projectId, authToken);
      } else {
        setError(`⚠️ ${syncResult.message}`);
        setSyncStatus(`⚠️ ${syncResult.message}`);
      }
    } catch (error) {
      console.error('Sync to database failed:', error);
      setError('Sync to database failed');
      setSyncStatus('❌ Sync failed');
    } finally {
      setSyncLoading(false);
    }
  };

  const reloadScenarios = async () => {
    if (!projectId) return;
    
    try {
      const allScenariosRaw = localStorage.getItem('local_scenarios');
      const allScenarios = allScenariosRaw ? JSON.parse(allScenariosRaw) : [];
      const scenariosData = allScenarios.filter((s: LocalScenario) => s.project_id === projectId);
      
      setScenarios(scenariosData);
      if (scenariosData.length === 0) {
        setHasGenerated(false);
      }
    } catch (error) {
      console.error('Error reloading scenarios:', error);
    }
  };

  // UPDATED: Handle generate new using local API
  const handleGenerateNew = async (): Promise<void> => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);
      setSyncStatus('Generating new scenarios via local API...');
      
      console.log('🚀 Generating new scenarios via local API...');
      
      const projectData = localStorageService.getProject(projectId!);
      if (!projectData) {
        throw new Error('Project not found');
      }
      
      const stories = localStorageService.getUserStoriesByProject(projectId!);
      const wireframesData = localStorageService.getWireframesByProject(projectId!);
      
      if (stories.length === 0) {
        throw new Error('No user stories found');
      }
      
      if (wireframesData.length === 0) {
        throw new Error('No wireframes found');
      }
      
      // Use local API for generation (it won't clear existing scenarios)
      await generateScenariosViaLocalAPI(projectId!, projectData, stories, wireframesData);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error generating scenarios';
      console.error("❌ Error generating scenarios:", errorMessage);
      setError(errorMessage);
      setSyncStatus('❌ Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = useCallback(async (): Promise<void> => {
  if (!projectId) {
    console.error("No project ID provided");
    return;
  }
  
  try {
    // Show loading/processing state
    setSuccess("Accepting scenarios...");
    
    // Quick local update
    const allScenariosRaw = localStorage.getItem('local_scenarios');
    if (allScenariosRaw) {
      const allScenarios: LocalScenario[] = JSON.parse(allScenariosRaw);
      const updatedScenarios = allScenarios.map(scenario => {
        if (scenario.project_id === projectId) {
          return { ...scenario, status: 'approved', updated_at: new Date().toISOString() };
        }
        return scenario;
      });
      localStorage.setItem('local_scenarios', JSON.stringify(updatedScenarios));
    }
    
    // Update local state
    const updatedCurrentScenarios = scenarios.map(scenario => ({
      ...scenario,
      status: 'approved' as const,
      updated_at: new Date().toISOString()
    }));
    setScenarios(updatedCurrentScenarios);
    
    // Navigate after brief delay for user feedback
    setTimeout(() => {
      navigate(`/preview-final/${projectId}`);
    }, 800);
    
  } catch (err) {
    console.error("Accept error:", err);
    setError("Error accepting scenarios");
    // Still navigate anyway
    setTimeout(() => {
      navigate(`/preview-final/${projectId}`);
    }, 1000);
  }
}, [navigate, projectId, scenarios]);


  // Function to normalize scenario type
  const normalizeScenarioType = (scenarioType: string | undefined): ScenarioType => {
    if (!scenarioType) return 'happy_path';
    
    const lowerType = scenarioType.toLowerCase();
    
    if (lowerType.includes('boundary')) {
      return 'boundary_case';
    }
    if (lowerType.includes('exception')) {
      return 'exception_path';
    }
    if (lowerType.includes('alternate')) {
      return 'alternate_path';
    }
    if (lowerType.includes('happy')) {
      return 'happy_path';
    }
    if (lowerType === 'boundary_path') {
      return 'boundary_case';
    }
    
    // Default mappings for known types
    switch (lowerType) {
      case 'happy_path':
      case 'alternate_path':
      case 'exception_path':
      case 'boundary_case':
        return lowerType as ScenarioType;
      default:
        return 'happy_path';
    }
  };

  // FIXED: Proper scenario statistics calculation
  const getScenarioStats = () => {
    // Count scenarios by normalized type
    const counts = {
      happy_path: 0,
      alternate_path: 0,
      exception_path: 0,
      boundary_case: 0,
    };
    
    scenarios.forEach(scenario => {
      const normalizedType = normalizeScenarioType(scenario.scenario_type);
      
      switch (normalizedType) {
        case 'happy_path':
          counts.happy_path++;
          break;
        case 'alternate_path':
          counts.alternate_path++;
          break;
        case 'exception_path':
          counts.exception_path++;
          break;
        case 'boundary_case':
          counts.boundary_case++;
          break;
      }
    });
    
    const total = scenarios.length;
    
    return {
      total,
      happy_path: counts.happy_path,
      alternate_path: counts.alternate_path,
      exception_path: counts.exception_path,
      boundary_case: counts.boundary_case,
    };
  };

  // Memoized scenario stats
  const scenarioStats = useMemo(() => getScenarioStats(), [scenarios]);

  // Function to find related wireframes for a scenario
  const getRelatedWireframes = (scenario: LocalScenario): string[] => {
    const relatedWireframes: string[] = [];
    
    // Check scenario text for wireframe/page references
    const scenarioText = (scenario.scenario_text || '').toLowerCase();
    const title = (scenario.title || '').toLowerCase();
    
    // Common page/wireframe keywords to look for
    const pageKeywords = [
      'dashboard', 'sensor', 'monitor', 'map', 'route', 'collection',
      'settings', 'configuration', 'report', 'analytics', 'login',
      'registration', 'profile', 'notification', 'alert'
    ];
    
    // Check if any wireframe page name appears in scenario
    wireframes.forEach(wf => {
      const pageName = wf.page_name.toLowerCase();
      
      // Direct match with page name
      if (scenarioText.includes(pageName) || title.includes(pageName)) {
        if (!relatedWireframes.includes(wf.page_name)) {
          relatedWireframes.push(wf.page_name);
        }
      }
      
      // Check for keyword matches
      pageKeywords.forEach(keyword => {
        if (pageName.includes(keyword) && 
            (scenarioText.includes(keyword) || title.includes(keyword))) {
          if (!relatedWireframes.includes(wf.page_name)) {
            relatedWireframes.push(wf.page_name);
          }
        }
      });
    });
    
    // If no specific wireframe found, use default based on scenario type
    if (relatedWireframes.length === 0) {
      const defaultWireframes: Record<string, string[]> = {
        'happy_path': ['Sensor Dashboard', 'Monitoring Interface', 'Main Dashboard'],
        'alternate_path': ['Quick Access Panel', 'Advanced Settings', 'Configuration Page'],
        'exception_path': ['Error Handling Page', 'Validation Screen'],
        'boundary_case': ['System Status Page', 'Performance Dashboard']
      };
      
      const normalizedType = normalizeScenarioType(scenario.scenario_type);
      const defaults = defaultWireframes[normalizedType] || ['Main Interface'];
      
      // Find matching wireframes from available ones
      defaults.forEach(defaultName => {
        const match = wireframes.find(wf => 
          wf.page_name.toLowerCase().includes(defaultName.toLowerCase().split(' ')[0])
        );
        if (match && !relatedWireframes.includes(match.page_name)) {
          relatedWireframes.push(match.page_name);
        }
      });
    }
    
    // Ensure we have at least one wireframe
    if (relatedWireframes.length === 0 && wireframes.length > 0) {
      relatedWireframes.push(wireframes[0].page_name);
    }
    
    return relatedWireframes.slice(0, 3); // Limit to 3 wireframes
  };

  // Function to format Gherkin steps for display
  const formatGherkinSteps = (steps: any[] | string[]): string[] => {
    if (!steps || !Array.isArray(steps)) return [];
    
    return steps.map(step => {
      if (typeof step === 'string') {
        // Clean up step formatting
        let cleanStep = step.trim();
        
        // Ensure proper Gherkin keyword formatting
        if (cleanStep.startsWith('Given ') || 
            cleanStep.startsWith('When ') || 
            cleanStep.startsWith('Then ') ||
            cleanStep.startsWith('And ') ||
            cleanStep.startsWith('But ')) {
          return cleanStep;
        }
        
        // Add Gherkin keyword if missing
        if (cleanStep.toLowerCase().includes('given')) {
          return cleanStep;
        }
        if (cleanStep.toLowerCase().includes('when')) {
          return cleanStep;
        }
        if (cleanStep.toLowerCase().includes('then')) {
          return cleanStep;
        }
        
        // Default to "And" for continuation steps
        return cleanStep;
      }
      return JSON.stringify(step);
    });
  };

  // Get user story by ID
  const getUserStoryById = (storyId: string | null): LocalUserStory | undefined => {
    if (!storyId) return undefined;
    return userStories.find(story => story.story_id === storyId);
  };

  // Function to group scenarios by user story
  const groupScenariosByUserStory = useCallback(() => {
    const grouped: {
      [storyId: string]: {
        story: LocalUserStory;
        scenarios: LocalScenario[];
      }
    } = {};
    
    // First, group scenarios with user_story_id
    scenarios.forEach(scenario => {
      if (scenario.user_story_id) {
        const storyId = scenario.user_story_id;
        
        if (!grouped[storyId]) {
          const story = getUserStoryById(storyId);
          if (story) {
            grouped[storyId] = {
              story,
              scenarios: []
            };
          } else {
            // If story not found, create a placeholder
            grouped[storyId] = {
              story: {
                story_id: storyId,
                story_text: `Unknown User Story (ID: ${storyId.substring(0, 8)}...)`,
                role: 'Unknown',
                action: 'unknown action',
                benefit: 'unknown benefit',
                feature: 'Unknown',
                priority: 'medium',
                status: 'draft',
                story_points: 0,
                generated_by_llm: false,
                iteration: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              } as LocalUserStory,
              scenarios: []
            };
          }
        }
        
        grouped[storyId].scenarios.push(scenario);
      }
    });
    
    // Then, handle orphaned scenarios (without user_story_id)
    const orphanedScenarios = scenarios.filter(s => !s.user_story_id);
    if (orphanedScenarios.length > 0) {
      grouped['orphaned'] = {
        story: {
          story_id: 'orphaned',
          story_text: 'General Scenarios (Not linked to specific user stories)',
          role: 'Various Users',
          action: 'various actions',
          benefit: 'various benefits',
          feature: 'Multiple Features',
          priority: 'medium',
          status: 'draft',
          story_points: 0,
          generated_by_llm: false,
          iteration: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as LocalUserStory,
        scenarios: orphanedScenarios
      };
    }
    
    return grouped;
  }, [scenarios, userStories]);

  // Memoized grouped scenarios
  const groupedScenarios = useMemo(() => groupScenariosByUserStory(), [groupScenariosByUserStory]);

  // Function to get scenario type stats for a user story
  const getScenarioTypeStatsForStory = (scenarios: LocalScenario[]) => {
    const counts = {
      happy_path: 0,
      alternate_path: 0,
      exception_path: 0,
      boundary_case: 0,
    };
    
    scenarios.forEach(scenario => {
      const normalizedType = normalizeScenarioType(scenario.scenario_type);
      
      switch (normalizedType) {
        case 'happy_path':
          counts.happy_path++;
          break;
        case 'alternate_path':
          counts.alternate_path++;
          break;
        case 'exception_path':
          counts.exception_path++;
          break;
        case 'boundary_case':
          counts.boundary_case++;
          break;
      }
    });
    
    return counts;
  };

  // Type labels for display
  const typeLabels: Record<string, string> = {
    'happy_path': 'Happy Path',
    'alternate_path': 'Alternate Path',
    'exception_path': 'Exception Path',
    'boundary_case': 'Boundary Case',
    'other': 'Other Scenarios'
  };

  // Type colors
  const typeColors: Record<string, string> = {
    'happy_path': 'bg-green-100 text-green-800 border-green-200',
    'alternate_path': 'bg-blue-100 text-blue-800 border-blue-200',
    'exception_path': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'boundary_case': 'bg-purple-100 text-purple-800 border-purple-200',
    'other': 'bg-gray-100 text-gray-800 border-gray-200'
  };

  // Sync status badge component
  const SyncStatusBadge = () => {
    if (!syncInfo) return null;
    
    const { is_synced, mode, database } = syncInfo;
    
    let badgeClass = '';
    let badgeText = '';
    
    if (mode === 'offline') {
      badgeClass = 'bg-gray-100 text-gray-800 border-gray-300';
      badgeText = '🔓 Offline Mode';
    } else if (mode === 'error') {
      badgeClass = 'bg-red-100 text-red-800 border-red-300';
      badgeText = '❌ Sync Error';
    } else if (is_synced) {
      badgeClass = 'bg-green-100 text-green-800 border-green-300';
      badgeText = `✅ Synced (DB: ${database.scenario_count})`;
    } else {
      badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-300';
      badgeText = '🔄 Needs Sync';
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badgeClass}`}>
        {badgeText}
      </span>
    );
  };

  const renderScenarios = () => {
    if (scenarios.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No scenarios generated yet</h3>
          <p className="text-gray-500 mb-6">Click the button below to generate scenarios via local API</p>
          <button
            onClick={handleGenerateNew}
            className="rounded-lg bg-green-500 px-6 py-3 text-white font-medium shadow-sm hover:bg-green-600 transition"
          >
            Generate Scenarios
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {Object.entries(groupedScenarios).map(([storyId, { story, scenarios: storyScenarios }]) => {
          const scenarioStats = getScenarioTypeStatsForStory(storyScenarios);
          
          return (
            <div key={storyId} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              {/* User Story Header */}
              <div className="mb-6 pb-4 border-b border-gray-100">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-semibold">US</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        User Story: {story.story_text}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div className="text-sm">
                        <span className="font-medium text-gray-600">Role:</span>
                        <span className="ml-2 text-gray-800">{story.role}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-600">Action:</span>
                        <span className="ml-2 text-gray-800">{story.action}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-600">Benefit:</span>
                        <span className="ml-2 text-gray-800">{story.benefit}</span>
                      </div>
                    </div>
                    
                    {story.feature && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                          🏷️ {story.feature}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Scenario Type Stats for this Story */}
                  <div className="flex flex-wrap gap-2">
                    {scenarioStats.happy_path > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        🟢 {scenarioStats.happy_path} Happy Path
                      </span>
                    )}
                    {scenarioStats.alternate_path > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        🔵 {scenarioStats.alternate_path} Alternate
                      </span>
                    )}
                    {scenarioStats.exception_path > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                        🟡 {scenarioStats.exception_path} Exception
                      </span>
                    )}
                    {scenarioStats.boundary_case > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                        🟣 {scenarioStats.boundary_case} Boundary
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-700">
                      📋 {storyScenarios.length} Total Scenarios
                    </span>
                  </div>
                </div>
              </div>

              {/* Scenarios for this User Story */}
              <div className="space-y-6">
                {storyScenarios.map((scenario, index) => {
                  const relatedWireframes = getRelatedWireframes(scenario);
                  const gherkinSteps = formatGherkinSteps(scenario.gherkin_steps || []);
                  const normalizedType = normalizeScenarioType(scenario.scenario_type);
                  
                  return (
                    <div key={scenario.scenario_id} className="border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition">
                      {/* Scenario Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${typeColors[normalizedType]}`}>
                              {typeLabels[normalizedType] || normalizedType.replace('_', ' ')}
                            </span>
                            <h4 className="font-medium text-gray-800">
                              {scenario.title || `Scenario ${index + 1}`}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600">
                            {scenario.scenario_text ? 
                              scenario.scenario_text.substring(0, 100) + (scenario.scenario_text.length > 100 ? '...' : '') : 
                              'No description'}
                          </p>
                        </div>
                        <div className="text-xs text-gray-400">
                          #{scenario.scenario_id.substring(0, 6)}
                        </div>
                      </div>

                      {/* Related Wireframes */}
                      <div className="mb-4">
                        <div className="text-xs font-medium text-gray-500 mb-2">
                          📍 Related Wireframes:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {relatedWireframes.map((wireframeName, idx) => (
                            <span 
                              key={idx}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              🎨 {wireframeName}
                            </span>
                          ))}
                          {relatedWireframes.length === 0 && wireframes.length > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700">
                              🎨 {wireframes[0].page_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Gherkin Steps */}
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-2">
                          🧪 Gherkin Steps:
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          {gherkinSteps.length > 0 ? (
                            gherkinSteps.map((step, stepIndex) => {
                              // Determine step type for styling
                              const stepText = step;
                              let stepClass = "text-gray-700";
                              
                              if (stepText.toLowerCase().startsWith('given')) {
                                stepClass = "text-green-700";
                              } else if (stepText.toLowerCase().startsWith('when')) {
                                stepClass = "text-blue-700";
                              } else if (stepText.toLowerCase().startsWith('then')) {
                                stepClass = "text-purple-700";
                              } else if (stepText.toLowerCase().startsWith('and')) {
                                stepClass = "text-gray-600";
                              } else if (stepText.toLowerCase().startsWith('but')) {
                                stepClass = "text-yellow-700";
                              }
                              
                              return (
                                <div 
                                  key={stepIndex} 
                                  className="flex items-start text-sm"
                                >
                                  <div className={`font-mono font-medium min-w-[50px] ${stepClass}`}>
                                    {stepText.split(' ')[0]}
                                  </div>
                                  <div className={`ml-2 ${stepClass}`}>
                                    {stepText.substring(stepText.indexOf(' ') + 1)}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-gray-500 italic text-sm">
                              No Gherkin steps available
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Metadata Footer */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                        <div>
                          <span className="mr-3">
                            ⚡ {normalizedType.replace('_', ' ').toUpperCase()}
                          </span>
                          {scenario.user_story_id && (
                            <span className="inline-flex items-center">
                              📝 Story ID: {scenario.user_story_id.substring(0, 6)}
                            </span>
                          )}
                        </div>
                        <div>
                          {new Date(scenario.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Story Footer */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div>
                    <span className="font-medium">Story ID:</span> {storyId.substring(0, 8)}...
                  </div>
                  <div className="text-xs">
                    {storyScenarios.length} scenario(s) • Last updated: {new Date(story.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Loading state
  if (loading || generating) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f9fafb]">
        <Header />
        <main className="flex-1 px-6 py-10">
          <div className="max-w-5xl mx-auto bg-white shadow-md rounded-xl p-6">
            <div className="flex flex-col items-center justify-center h-64">
              <div className="text-lg text-gray-600 mb-4">
                {generating ? "Generating scenarios via local API..." : 
                 syncLoading ? "Syncing scenarios..." : 
                 "Loading scenarios..."}
              </div>
              <div className="w-full max-w-md">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-400 to-blue-500 animate-pulse"></div>
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-4">
                {syncStatus || "Processing..."}
              </div>
              {syncInfo && (
                <div className="mt-4">
                  <SyncStatusBadge />
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f9fafb]">
        <Header />
        <main className="flex-1 px-6 py-10">
          <div className="max-w-5xl mx-auto bg-white shadow-md rounded-xl p-6">
            <div className="flex flex-col items-center justify-center h-64">
              <div className="text-red-500 text-lg mb-4 text-center">
                <div className="font-semibold">Error</div>
                <div className="text-sm mt-2">{error}</div>
              </div>
              {syncInfo && <div className="mb-4"><SyncStatusBadge /></div>}
              <div className="flex flex-wrap gap-3 justify-center">
                {isAuthenticated && syncInfo && !syncInfo.is_synced && (
                  <button
                    onClick={handleManualSync}
                    disabled={syncLoading}
                    className="rounded-lg bg-blue-500 px-6 py-2 text-white font-medium hover:bg-blue-600 disabled:opacity-50 transition"
                  >
                    {syncLoading ? 'Syncing...' : 'Try Sync'}
                  </button>
                )}
                <button
                  onClick={() => navigate(-1)}
                  className="rounded-lg bg-gray-500 px-6 py-2 text-white font-medium hover:bg-gray-600 transition"
                >
                  Go Back
                </button>
                <button
                  onClick={handleGenerateNew}
                  className="rounded-lg bg-green-500 px-6 py-2 text-white font-medium hover:bg-green-600 transition"
                >
                  Generate Scenarios
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f9fafb]">
      <Header />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white shadow-md rounded-xl p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-[#3E4766]">
                  {projectTitle} - Test Scenarios
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Project ID: {projectId}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-sm text-gray-600">
                    📝 {userStories.length} user stories
                  </span>
                  <span className="text-sm text-gray-600">
                    🎨 {wireframes.length} wireframes
                  </span>
                  <span className="text-sm text-gray-600">
                    🧪 {scenarios.length} scenarios
                  </span>
                  {syncInfo && (
                    <span className="text-sm">
                      <SyncStatusBadge />
                    </span>
                  )}
                </div>
                {syncStatus && (
                  <div className="text-sm text-gray-600 mt-2">
                    {syncStatus}
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-3">
                {/* Sync controls for authenticated users */}
                {isAuthenticated && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={handleManualSync}
                      disabled={syncLoading}
                      className="rounded-lg bg-blue-500 px-4 py-2 text-white font-medium hover:bg-blue-600 disabled:opacity-50 transition text-sm"
                    >
                      {syncLoading ? 'Syncing...' : 'Sync'}
                    </button>
                    <button
                      onClick={handleForceSyncFromDatabase}
                      disabled={syncLoading}
                      className="rounded-lg bg-purple-500 px-4 py-2 text-white font-medium hover:bg-purple-600 disabled:opacity-50 transition text-sm"
                    >
                      Pull from DB
                    </button>
                    <button
                      onClick={handleSyncToDatabase}
                      disabled={syncLoading}
                      className="rounded-lg bg-indigo-500 px-4 py-2 text-white font-medium hover:bg-indigo-600 disabled:opacity-50 transition text-sm"
                    >
                      Push to DB
                    </button>
                  </div>
                )}
                
                <button
                  onClick={handleGenerateNew}
                  className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-5 py-2 text-white font-medium shadow-sm hover:opacity-95"
                >
                  {hasGenerated ? "Regenerate" : "Generate Scenarios"}
                </button>
                
                {scenarios.length > 0 && (
                  <button
                    onClick={handleAccept}
                    className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-5 py-2 text-white font-medium shadow-sm hover:opacity-95"
                  >
                    Accept & Continue
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Statistics - Fixed */}
          <div className="bg-white shadow-md rounded-xl p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Scenario Overview</h2>
              {syncInfo && syncInfo.database.scenario_count > 0 && (
                <span className="text-sm text-gray-600">
                  Database: {syncInfo.database.scenario_count} • Local: {syncInfo.local.scenario_count}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{scenarioStats.happy_path}</div>
                <div className="text-sm text-green-600">HAPPY PATH</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{scenarioStats.alternate_path}</div>
                <div className="text-sm text-blue-600">ALTERNATE PATH</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{scenarioStats.exception_path}</div>
                <div className="text-sm text-yellow-600">EXCEPTION PATH</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-700">{scenarioStats.boundary_case}</div>
                <div className="text-sm text-purple-600">BOUNDARY CASE</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-800">{scenarioStats.total}</div>
                <div className="text-sm text-gray-600">TOTAL</div>
              </div>
            </div>
          </div>

          {/* Scenarios List - Grouped by User Story */}
          <div className="bg-white shadow-md rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-800">
                {hasGenerated ? `Scenarios by User Story (${Object.keys(groupedScenarios).length} stories)` : "Ready to Generate Scenarios"}
              </h2>
              <div className="text-sm text-gray-500">
                Showing {scenarios.length} scenarios across {Object.keys(groupedScenarios).length} user stories
              </div>
            </div>
            
            {renderScenarios()}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}