// frontend/app/services/ScenarioService.ts
import { localStorageService } from "../utils/localStorageService";
import type { LocalProject, LocalUserStory, LocalWireframe, LocalScenario } from "../utils/localStorageModels";
import { scenarioSyncService } from "./ScenarioSyncService";

interface EnhancedScenario extends LocalScenario {
  display_data?: {
    page_name?: string;
    related_stories?: string[];
    scenario_type_label: string;
    has_valid_gherkin: boolean;
    steps_count: number;
    generated_at: string;
    used_fallback: boolean;
    used_llm: boolean;
  };
}

class ScenarioService {
  private static instance: ScenarioService;
  
  // Rate limiting configuration
  private readonly RATE_LIMIT_CONFIG = {
    maxRequestsPerMinute: 6,
    minDelayBetweenRequests: 10000,
    burstLimit: 1,
    maxRetries: 3,
  };

  // Request tracking
  private requestQueue: Array<{
    timestamp: number;
    projectId: string;
    storyId: string;
  }> = [];

  public static getInstance(): ScenarioService {
    if (!ScenarioService.instance) {
      ScenarioService.instance = new ScenarioService();
    }
    return ScenarioService.instance;
  }

  // ===== RATE LIMITING METHODS =====
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    this.requestQueue = this.requestQueue.filter(req => req.timestamp > oneMinuteAgo);
    
    if (this.requestQueue.length >= this.RATE_LIMIT_CONFIG.maxRequestsPerMinute) {
      const oldestRequest = this.requestQueue[0];
      const timeToWait = Math.max(0, (oldestRequest.timestamp + 60000) - now);
      
      if (timeToWait > 0) {
        console.log(`⏳ Rate limit reached. Waiting ${timeToWait / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait + 1000));
      }
    }
    
    const recentRequests = this.requestQueue.filter(req => req.timestamp > now - 5000);
    if (recentRequests.length >= this.RATE_LIMIT_CONFIG.burstLimit) {
      const delay = this.RATE_LIMIT_CONFIG.minDelayBetweenRequests;
      console.log(`⏳ Burst limit reached. Waiting ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.requestQueue.push({
      timestamp: Date.now(),
      projectId: '',
      storyId: '',
    });
  }

  private async callWithRateLimit<T>(
    apiCall: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      await this.waitForRateLimit();
      return await apiCall();
    } catch (error: any) {
      if (error.status === 429 && retryCount < this.RATE_LIMIT_CONFIG.maxRetries) {
        const waitTime = Math.pow(2, retryCount) * 5000;
        console.log(`🔄 Rate limited. Retry ${retryCount + 1}/${this.RATE_LIMIT_CONFIG.maxRetries} in ${waitTime / 1000}s`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.callWithRateLimit(apiCall, retryCount + 1);
      }
      throw error;
    }
  }

  // ===== AUTOMATIC SYNC METHODS =====
  
  // Automatic sync when entering website/page
  async autoSyncOnEntry(projectId: string, token?: string | null): Promise<{
    success: boolean;
    syncedFromDb: boolean;
    message: string;
    scenarioCount?: number;
  }> {
    // If no token, we're offline
    if (!token) {
      console.log('🟡 OFFLINE: No token, skipping database sync for scenarios');
      return {
        success: true,
        syncedFromDb: false,
        message: 'Offline mode - using local data only'
      };
    }

    try {
      console.log('🔄 Starting automatic scenario sync on page entry...');
      
      // First check if scenarios exist in database
      const checkResult = await this.callWithRateLimit(() => 
        scenarioSyncService.checkScenariosExist(projectId, token)
      );
      
      if (checkResult.success && checkResult.exists && checkResult.scenarioCount > 0) {
        // Database has scenarios, sync FROM database TO localStorage
        const syncResult = await this.callWithRateLimit(() => 
          scenarioSyncService.syncDatabaseToLocalStorage(projectId, token)
        );
        
        if (syncResult.success && syncResult.syncedCount > 0) {
          console.log(`✅ Auto-synced ${syncResult.syncedCount} scenarios from database`);
          
          const updatedScenarios = localStorageService.getScenariosByProject(projectId);
          return {
            success: true,
            syncedFromDb: true,
            message: `Auto-synced ${syncResult.syncedCount} scenarios from database`,
            scenarioCount: updatedScenarios.length
          };
        }
      }
      
      // If database empty or sync failed, check if we have local data to sync TO database
      const localScenarios = localStorageService.getScenariosByProject(projectId);
      if (localScenarios.length > 0) {
        console.log(`📤 Auto-syncing ${localScenarios.length} local scenarios to database...`);
        const uploadResult = await this.callWithRateLimit(() => 
          scenarioSyncService.syncLocalToDatabase(projectId, token)
        );
        
        return {
          success: uploadResult.success,
          syncedFromDb: false,
          message: uploadResult.message,
          scenarioCount: localScenarios.length
        };
      }
      
      // No scenarios anywhere
      return {
        success: true,
        syncedFromDb: false,
        message: 'No scenarios found to sync',
        scenarioCount: 0
      };
      
    } catch (error) {
      console.error('Auto-sync failed:', error);
      return {
        success: false,
        syncedFromDb: false,
        message: `Auto-sync error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Automatic sync after generation
  async autoSyncAfterGeneration(projectId: string, token: string, newlyGeneratedCount: number): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      console.log(`🔄 Auto-syncing ${newlyGeneratedCount} newly generated scenarios to database...`);
      
      // First, sync all local scenarios to database
      const syncResult = await this.callWithRateLimit(() => 
        scenarioSyncService.syncLocalToDatabase(projectId, token)
      );
      
      if (syncResult.success) {
        console.log(`✅ Auto-synced ${syncResult.syncedCount} scenarios to database after generation`);
        return syncResult;
      } else {
        console.warn('⚠️ Auto-sync after generation failed:', syncResult.message);
        return syncResult;
      }
    } catch (error) {
      console.error('Auto-sync after generation failed:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Auto-sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Unified method that handles automatic sync on entry AND after generation
  async generateScenariosWithSync(
    projectId: string, 
    token?: string | null, 
    projectData?: LocalProject,
    userStoriesData?: LocalUserStory[],
    wireframesData?: LocalWireframe[]
  ): Promise<{
    success: boolean;
    message: string;
    data?: LocalScenario[];
    count?: number;
    source?: string;
    error?: string;
    autoSynced?: boolean;
  }> {
    try {
      const isAuthenticated = !!token;
      
      // STEP 1: Auto-sync on entry (if authenticated)
      if (isAuthenticated && token) {
        console.log('🔄 Authenticated: Performing auto-sync on entry for scenarios...');
        const autoSyncResult = await this.callWithRateLimit(() => 
          this.autoSyncOnEntry(projectId, token)
        );
        
        if (autoSyncResult.success && autoSyncResult.syncedFromDb && autoSyncResult.scenarioCount && autoSyncResult.scenarioCount > 0) {
          // If we got data from database, return it
          console.log('✅ Using auto-synced scenarios from database');
          const scenarios = localStorageService.getScenariosByProject(projectId);
          return {
            success: true,
            message: `Auto-loaded ${scenarios.length} scenarios from database`,
            data: scenarios,
            count: scenarios.length,
            source: 'database',
            autoSynced: true
          };
        }
      }
      
      // STEP 2: Check if we already have scenarios locally
      const existingScenarios = localStorageService.getScenariosByProject(projectId);
      if (existingScenarios.length > 0) {
        console.log(`ℹ️ Found ${existingScenarios.length} existing local scenarios`);
        return {
          success: true,
          message: `Loaded ${existingScenarios.length} existing scenarios`,
          data: existingScenarios,
          count: existingScenarios.length,
          source: 'local_cache',
          autoSynced: false
        };
      }
      
      // STEP 3: If no scenarios exist, generate new ones
      console.log('🔄 No scenarios found, generating new...');
      
      if (isAuthenticated && token) {
        // Generate via API with rate limiting
        const generationResult = await this.callWithRateLimit(() => 
          this.generateScenariosOnline(projectId, token, projectData, userStoriesData, wireframesData)
        );
        
        // STEP 4: Auto-sync to database after generation
        if (generationResult.success && generationResult.data && generationResult.data.length > 0) {
          console.log('🔄 Auto-syncing newly generated scenarios to database...');
          const autoSyncResult = await this.callWithRateLimit(() => 
            this.autoSyncAfterGeneration(projectId, token, generationResult.data?.length || 0)
          );
          
          if (autoSyncResult.success) {
            console.log(`✅ Auto-synced ${autoSyncResult.syncedCount} scenarios to database`);
            generationResult.message = `${generationResult.message} (Auto-synced to database)`;
          } else {
            console.warn('⚠️ Auto-sync after generation failed:', autoSyncResult.message);
          }
        }
        
        return {
          ...generationResult,
          autoSynced: true
        };
      } else {
        // Generate locally
        const project = projectData || localStorageService.getProject(projectId);
        if (!project) {
          throw new Error('Project not found');
        }
        
        const userStories = userStoriesData || localStorageService.getUserStoriesByProject(projectId);
        if (!userStories || userStories.length === 0) {
          throw new Error('No user stories found. Generate user stories first.');
        }

        const wireframes = wireframesData || localStorageService.getWireframesByProject(projectId);
        if (!wireframes || wireframes.length === 0) {
          throw new Error('No wireframes found. Generate wireframes first.');
        }
        
        const scenarios = await this.generateScenariosOffline(project, userStories, wireframes);
        
        return {
          success: true,
          message: `Generated ${scenarios.length} scenarios locally`,
          data: scenarios,
          count: scenarios.length,
          source: 'offline_generated',
          autoSynced: false
        };
      }
      
    } catch (error) {
      console.error('Scenario generation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error',
        autoSynced: false
      };
    }
  }

  // Generate scenarios via API (authenticated)
  async generateScenariosOnline(
  projectId: string, 
  token: string, 
  projectData?: LocalProject,
  userStoriesData?: LocalUserStory[],
  wireframesData?: LocalWireframe[]
): Promise<{
  success: boolean;
  message: string;
  data?: LocalScenario[];
  count?: number;
  error?: string;
}> {
  try {
    console.log('Attempting to generate scenarios for project:', projectId);

    const project = projectData || localStorageService.getProject(projectId);
    const userStories = userStoriesData || localStorageService.getUserStoriesByProject(projectId);
    const wireframes = wireframesData || localStorageService.getWireframesByProject(projectId);

    if (!project) {
      throw new Error('Project not found');
    }
    if (!userStories || userStories.length === 0) {
      throw new Error('No user stories found');
    }
    if (!wireframes || wireframes.length === 0) {
      throw new Error('No wireframes found');
    }

    // Prepare data for API call
    const apiProjectData = {
      title: project.title,
      objective: project.objective || '',
      users: Array.isArray(project.users_data) ? project.users_data : [],
      features: Array.isArray(project.features_data) ? project.features_data : [],
      scope: project.scope || '',
      flow: project.flow || '',
      additional_info: project.additional_info || '',
      domain: project.domain || 'general'
    };

    const apiUserStories = userStories.slice(0, 3).map(story => ({
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

    const apiWireframes = wireframes.slice(0, 2).map(wf => ({
      wireframe_id: wf.wireframe_id,
      page_name: wf.page_name,
      html_content: wf.html_content || '',
      page_type: wf.page_type || 'general'
    }));

    const response = await fetch('/api/local-projects/generate-scenarios/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        project_id: projectId,
        project_data: apiProjectData,
        user_stories: apiUserStories,
        wireframes: apiWireframes
      })
    });

    console.log('Scenario API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Scenario API Error:', errorText);
      
      if (response.status === 429) {
        throw { 
          status: 429, 
          message: 'Rate limited by server. Please try again later.' 
        };
      }
      
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log('Scenario API Response data:', data);

    if (!data.success) {
      throw new Error(data.error || data.message || 'Scenario generation failed on server');
    }

    // Save scenarios to localStorage for consistency
    if (data.scenarios && Array.isArray(data.scenarios)) {
      // FIX: Call the correct method with single parameter
      const scenarios = this.saveScenariosToLocalStorage(data.scenarios, projectId);
      return {
        success: true,
        message: data.message || 'Scenarios generated successfully',
        data: scenarios,
        count: scenarios.length
      };
    }

    return {
      success: true,
      message: data.message || 'Scenarios generated successfully',
      data: [],
      count: 0
    };
  } catch (error) {
    console.error('Error generating scenarios online:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


  // Generate scenarios offline (fallback/template-based)
  async generateScenariosOffline(
    project: LocalProject,
    userStories: LocalUserStory[],
    wireframes: LocalWireframe[]
  ): Promise<LocalScenario[]> {
    console.log('Generating scenarios offline for project:', project.title);

    const scenarios: LocalScenario[] = [];
    const now = new Date().toISOString();
    
    // Limit to 3 user stories for performance
    userStories.slice(0, 3).forEach((story, storyIndex) => {
      const role = story.role || 'User';
      const action = story.action || 'use system';
      const benefit = story.benefit || 'achieve goal';
      const feature = story.feature || 'General';

      // Create different scenario types
      const scenarioTypes = [
        {
          type: 'happy_path' as const,
          text: `Scenario: Happy Path - ${action}\nGiven ${role} wants to ${action}\nWhen they follow the correct procedure\nThen the system should process the request successfully\nAnd ${benefit}`,
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
          text: `Scenario: Alternate Path - ${action} with different approach\nGiven ${role} needs to ${action}\nWhen they choose an alternative method\nThen the system should accommodate the variation\nAnd ${benefit}`,
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
          text: `Scenario: Exception Path - ${action} with invalid input\nGiven ${role} attempts to ${action}\nWhen they provide invalid or missing data\nThen the system should display appropriate error messages\nAnd guide them to correct the input`,
          title: `Error in ${action}`,
          steps: [
            `Given ${role} attempts to ${action}`,
            `When they provide invalid or missing data`,
            `Then the system should display appropriate error messages`,
            `And guide them to correct the input`
          ]
        },
        {
          type: 'boundary_case' as const,
          text: `Scenario: Boundary Case - ${action} at system limits\nGiven ${role} attempts to ${action}\nWhen the system is at maximum capacity\nThen it should handle the request gracefully\nAnd maintain system stability`,
          title: `Boundary ${action}`,
          steps: [
            `Given ${role} attempts to ${action}`,
            `When the system is at maximum capacity`,
            `Then it should handle the request gracefully`,
            `And maintain system stability`
          ]
        }
      ];

      scenarioTypes.forEach((scenarioType, typeIndex) => {
        const scenarioId = `offline_${project.project_id}_${story.story_id}_${scenarioType.type}_${Date.now()}_${storyIndex}_${typeIndex}`;
        
        const scenario: Omit<LocalScenario, 'scenario_id' | 'created_at' | 'updated_at'> = {
          project_id: project.project_id,
          user_story_id: story.story_id,
          scenario_text: scenarioType.text,
          scenario_type: scenarioType.type,
          title: scenarioType.title,
          detected_domain: project.domain || 'general',
          has_proper_structure: true,
          gherkin_steps: scenarioType.steps,
          enhanced_with_llm: false,
          status: 'draft',
          is_local: true
        };

        const savedScenario = localStorageService.createScenario(scenario, scenarioId);
        scenarios.push(savedScenario);
      });
    });

    console.log(`Generated ${scenarios.length} scenarios offline`);
    return scenarios;
  }

  // Save scenarios to localStorage WITHOUT timestamp keys
  private saveScenariosToLocalStorage(apiScenarios: any[], projectId: string): LocalScenario[] {
  try {
    console.log('💾 Saving scenarios to localStorage');
    
    const existingScenarios = localStorageService.getScenariosByProject(projectId);
    
    // Delete existing scenarios for this project
    existingScenarios.forEach(scenario => {
      this.deleteScenarioLocal(scenario.scenario_id);
    });

    const savedScenarios: LocalScenario[] = [];

    apiScenarios.forEach((apiScenario: any) => {
      // Remove is_local from the object since it's not in Omit type
      const { is_local, ...scenarioData } = apiScenario;
      
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
        is_local: true  // This will be added by the createScenario method
      };

      // FIX: Call createScenario with single parameter (it will generate ID automatically)
      const savedScenario = localStorageService.createScenario(scenarioInput);
      savedScenarios.push(savedScenario);
    });
    
    console.log(`✅ Successfully saved ${savedScenarios.length} scenarios to localStorage`);
    return savedScenarios;
  } catch (error) {
    console.error('Failed to save scenarios to localStorage:', error);
    return [];
  }
}

  // Helper method to delete scenario locally
  private deleteScenarioLocal(scenarioId: string): void {
    try {
      const scenariosJson = localStorage.getItem('local_scenarios');
      if (!scenariosJson) return;

      const scenarios: LocalScenario[] = JSON.parse(scenariosJson);
      const filteredScenarios = scenarios.filter(s => s.scenario_id !== scenarioId);
      
      localStorage.setItem('local_scenarios', JSON.stringify(filteredScenarios));
    } catch (error) {
      console.error('Error deleting scenario locally:', error);
    }
  }

  // Two-way sync scenarios
  async twoWaySyncScenarios(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      console.log('🔄 Starting two-way scenario sync...');
      
      const result = await this.callWithRateLimit(() => 
        scenarioSyncService.twoWaySyncScenarios(projectId, token)
      );
      
      if (result.success) {
        console.log(`✅ Two-way sync completed: ${result.message}`);
        return {
          success: true,
          syncedCount: result.syncedCount,
          message: result.message
        };
      } else {
        console.warn('⚠️ Two-way sync failed:', result.message);
        return {
          success: false,
          syncedCount: 0,
          message: result.message
        };
      }
    } catch (error) {
      console.error('Two-way sync failed:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Two-way sync error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

    async getScenarioSyncStatus(projectId: string, token?: string | null): Promise<{
    success: boolean;
    sync_status: any;
    message: string;
  }> {
    if (!token) {
      const localScenarios = localStorageService.getScenariosByProject(projectId);
      return {
        success: true,
        sync_status: {
          is_synced: true,
          database: { scenario_count: 0, last_updated: null },
          local: { 
            scenario_count: localScenarios.length,
            last_updated: localScenarios.length > 0 
              ? new Date(Math.max(...localScenarios.map(s => new Date(s.updated_at || s.created_at).getTime()))).toISOString()
              : null
          },
          needs_sync: false,
          mode: 'offline'
        },
        message: 'Offline mode - sync not available'
      };
    }

    try {
      return await this.callWithRateLimit(() => 
        this.fetchScenarioSyncStatusFromApi(projectId, token)
      );
    } catch (error) {
      console.error('Error getting sync status:', error);
      const localScenarios = localStorageService.getScenariosByProject(projectId);
      return {
        success: false,
        sync_status: {
          is_synced: false,
          database: { scenario_count: 0, last_updated: null },
          local: { 
            scenario_count: localScenarios.length,
            last_updated: localScenarios.length > 0 
              ? new Date(Math.max(...localScenarios.map(s => new Date(s.updated_at || s.created_at).getTime()))).toISOString()
              : null
          },
          needs_sync: false,
          mode: 'error'
        },
        message: `Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async fetchScenarioSyncStatusFromApi(projectId: string, token: string): Promise<{
    success: boolean;
    sync_status: any;
    message: string;
  }> {
    try {
      const localScenarios = localStorageService.getScenariosByProject(projectId);
      const localCount = localScenarios.length;
      const localLastUpdate = localScenarios.length > 0 
        ? new Date(Math.max(...localScenarios.map(s => new Date(s.updated_at || s.created_at).getTime()))).toISOString()
        : null;

      const queryParams = new URLSearchParams({
        local_count: localCount.toString(),
        ...(localLastUpdate && { local_last_update: localLastUpdate })
      });

      const response = await fetch(`/api/projects/${projectId}/scenario-sync-status/?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.success,
        sync_status: data.sync_status,
        message: data.message || 'Sync status retrieved'
      };

    } catch (error) {
      console.error('Error fetching scenario sync status:', error);
      throw error;
    }
  }

  // Enhanced scenario methods
  async enhanceScenariosForDisplay(projectId: string): Promise<EnhancedScenario[]> {
    try {
      const scenarios = localStorageService.getScenariosByProject(projectId);
      const userStories = localStorageService.getUserStoriesByProject(projectId);
      const wireframes = localStorageService.getWireframesByProject(projectId);

      return scenarios.map(scenario => {
        const relatedStories = userStories.filter(story => 
          story.story_id === scenario.user_story_id
        );
        
        const storyText = relatedStories[0]?.story_text || '';
        const role = relatedStories[0]?.role || 'User';
        const action = relatedStories[0]?.action || '';
        
        // Find related wireframes based on story content
        const relatedWireframes = this.findRelatedWireframes(storyText, wireframes);
        
        // Determine if scenario has valid Gherkin structure
        const gherkinSteps = scenario.gherkin_steps || [];
        const hasValidGherkin = gherkinSteps.length > 0 && 
          (gherkinSteps.some(step => step.startsWith('Given')) ||
           gherkinSteps.some(step => step.startsWith('When')) ||
           gherkinSteps.some(step => step.startsWith('Then')));

        // Create enhanced display data
        const displayData = {
          page_name: relatedWireframes.length > 0 ? relatedWireframes[0].page_name : 'Unknown Page',
          related_stories: relatedStories.map(story => story.story_text.substring(0, 100) + '...'),
          scenario_type_label: this.getScenarioTypeLabel(scenario.scenario_type),
          has_valid_gherkin: hasValidGherkin,
          steps_count: gherkinSteps.length,
          generated_at: scenario.created_at || new Date().toISOString(),
          used_fallback: scenario.scenario_text?.includes('fallback') || false,
          used_llm: scenario.enhanced_with_llm || false
        };

        return {
          ...scenario,
          display_data: displayData
        } as EnhancedScenario;
      });
    } catch (error) {
      console.error('Error enhancing scenarios for display:', error);
      return [];
    }
  }

  private findRelatedWireframes(storyText: string, wireframes: LocalWireframe[]): LocalWireframe[] {
    if (!storyText || wireframes.length === 0) return [];

    const storyTextLower = storyText.toLowerCase();
    
    return wireframes.filter(wireframe => {
      const pageNameLower = wireframe.page_name.toLowerCase();
      const htmlContentLower = (wireframe.html_content || '').toLowerCase();
      
      // Check if wireframe page name appears in story text
      if (storyTextLower.includes(pageNameLower) || 
          pageNameLower.includes(storyTextLower.substring(0, 20))) {
        return true;
      }
      
      // Check for common keywords
      const keywords = ['dashboard', 'login', 'profile', 'settings', 'search', 'report', 'analytics'];
      const foundKeyword = keywords.some(keyword => 
        storyTextLower.includes(keyword) && pageNameLower.includes(keyword)
      );
      
      return foundKeyword;
    }).slice(0, 3); // Limit to 3 wireframes
  }

  private getScenarioTypeLabel(scenarioType: string): string {
    const labels: Record<string, string> = {
      'happy_path': 'Happy Path',
      'alternate_path': 'Alternate Path',
      'exception_path': 'Exception Path',
      'boundary_case': 'Boundary Case',
      'boundary_path': 'Boundary Path',
      'other': 'Other Scenario'
    };
    
    return labels[scenarioType] || scenarioType.replace('_', ' ').toUpperCase();
  }

  // Scenario statistics
  // In ScenarioService.ts - SIMPLIFIED FIX
// In ScenarioService.ts - WORKING FIX
async getScenarioStatistics(resourceId: string, type: 'story' | 'project' = 'project') {
  try {
    // Get scenarios from localStorage directly
    const scenarios = localStorageService.getScenariosByProject(resourceId);
    
    if (scenarios.length === 0) {
      return null; // No scenarios found
    }
    
    // Cast to any to bypass TypeScript strict type checking
    // This is safe because we're working with runtime data
    const scenariosAny: any[] = scenarios as any[];
    
    return {
      total: scenarios.length,
      byType: {
        main_success: scenariosAny.filter(s => 
          s.scenario_type === 'main_success' || s.scenario_type === 'happy_path'
        ).length,
        alternative: scenariosAny.filter(s => 
          s.scenario_type === 'alternative' || s.scenario_type === 'alternate_path'
        ).length,
        edge_case: scenariosAny.filter(s => 
          s.scenario_type === 'edge_case' || 
          s.scenario_type === 'boundary_case' || 
          s.scenario_type === 'boundary_path'
        ).length,
        other: scenariosAny.filter(s => 
          !['main_success', 'happy_path', 'alternative', 'alternate_path', 
            'edge_case', 'boundary_case', 'boundary_path'].includes(s.scenario_type)
        ).length
      },
      byStatus: {
        draft: scenariosAny.filter(s => s.status === 'draft').length,
        accepted: scenariosAny.filter(s => s.status === 'accepted').length,
        rejected: scenariosAny.filter(s => s.status === 'rejected').length
      },
      withProperStructure: scenariosAny.filter(s => s.has_proper_structure).length,
      enhancedWithLLM: scenariosAny.filter(s => s.enhanced_with_llm).length
    };
  } catch (error) {
    console.error(`❌ Error getting ${type} scenario statistics:`, error);
    return null;
  }
}

  // Group scenarios by user story
  groupScenariosByUserStory(projectId: string) {
    const scenarios = localStorageService.getScenariosByProject(projectId);
    const userStories = localStorageService.getUserStoriesByProject(projectId);
    
    const grouped: Record<string, {
      story: LocalUserStory;
      scenarios: LocalScenario[];
    }> = {};
    
    // First, group by user_story_id
    scenarios.forEach(scenario => {
      if (scenario.user_story_id) {
        const storyId = scenario.user_story_id;
        
        if (!grouped[storyId]) {
          const story = userStories.find(s => s.story_id === storyId);
          if (story) {
            grouped[storyId] = {
              story,
              scenarios: []
            };
          } else {
            // Create placeholder story
            grouped[storyId] = {
              story: {
                story_id: storyId,
                project_id: projectId,
                story_text: `Unknown Story (ID: ${storyId.substring(0, 8)}...)`,
                role: 'Unknown',
                action: 'unknown',
                benefit: 'unknown',
                feature: 'Unknown',
                priority: 'medium',
                story_points: 0,
                status: 'draft',
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
    
    // Handle orphaned scenarios (without user_story_id)
    const orphanedScenarios = scenarios.filter(s => !s.user_story_id);
    if (orphanedScenarios.length > 0) {
      grouped['orphaned'] = {
        story: {
          story_id: 'orphaned',
          project_id: projectId,
          story_text: 'General Scenarios (Not linked to specific user stories)',
          role: 'Various Users',
          action: 'various actions',
          benefit: 'various benefits',
          feature: 'Multiple Features',
          priority: 'medium',
          story_points: 0,
          status: 'draft',
          generated_by_llm: false,
          iteration: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as LocalUserStory,
        scenarios: orphanedScenarios
      };
    }
    
    return grouped;
  }
}

export { ScenarioService };