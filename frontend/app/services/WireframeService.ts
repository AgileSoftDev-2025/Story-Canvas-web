// frontend/app/services/WireframeService.ts
import { localStorageService } from "../utils/localStorageService";
import type { LocalProject, LocalUserStory, LocalWireframe, CreateLocalWireframe } from "../utils/localStorageModels";
import { wireframeAPIService } from "./wireframeSyncService";

// Interface for enhanced wireframe with full LLM response
interface EnhancedWireframe extends LocalWireframe {
  display_data: {
    page_name: string;
    page_type: LocalWireframe['page_type'];
    html_preview: string;
    has_valid_structure: boolean;
    stories_count: number;
    features_count: number;
    generated_at: string;
    debug_status: string;
    llm_response_preview: string;
    llm_response_length: number;
    html_length: number;
    used_rag: boolean;
    used_fallback: boolean;
    generation_error?: string;
    ui_patterns_used: number;
    project_patterns_used: number;
  };
  full_llm_response?: string;
}

class WireframeService {
  private static instance: WireframeService;
  
  // Rate limiting configuration
  private readonly RATE_LIMIT_CONFIG = {
    maxRequestsPerMinute: 6, // Replicate free tier limit
    minDelayBetweenRequests: 10000, // 10 seconds minimum between requests
    burstLimit: 1, // Burst requests allowed
    maxRetries: 3, // Max retries on rate limit
  };

  // Request tracking
  private requestQueue: Array<{
    timestamp: number;
    projectId: string;
    pageName: string;
  }> = [];

  public static getInstance(): WireframeService {
    if (!WireframeService.instance) {
      WireframeService.instance = new WireframeService();
    }
    return WireframeService.instance;
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
      pageName: '',
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

  async autoSyncAfterRegeneration(projectId: string, token: string, newlyGeneratedCount: number): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      console.log(`🔄 Auto-syncing ${newlyGeneratedCount} newly generated wireframes to database...`);
      
      // First, sync all local wireframes to database
      const syncResult = await this.callWithRateLimit(() => 
        wireframeAPIService.syncLocalToDatabase(projectId, token)
      );
      
      if (syncResult.success) {
        console.log(`✅ Auto-synced ${syncResult.syncedCount} wireframes to database after regeneration`);
        return syncResult;
      } else {
        console.warn('⚠️ Auto-sync after regeneration failed:', syncResult.message);
        return syncResult;
      }
    } catch (error) {
      console.error('Auto-sync after regeneration failed:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Auto-sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async autoSyncOnEntry(projectId: string, token?: string | null): Promise<{
    success: boolean;
    syncedFromDb: boolean;
    message: string;
    wireframeCount?: number;
  }> {
    // If no token, we're offline
    if (!token) {
      console.log('🟡 OFFLINE: No token, skipping database sync');
      return {
        success: true,
        syncedFromDb: false,
        message: 'Offline mode - using local data only'
      };
    }

    try {
      console.log('🔄 Starting automatic wireframe sync on page entry...');
      
      // First check if wireframes exist in database
      const checkResult = await this.callWithRateLimit(() => 
        wireframeAPIService.checkWireframesExist(projectId, token)
      );
      
      if (checkResult.success && checkResult.exists && checkResult.wireframe_count > 0) {
        // Database has wireframes, sync FROM database TO localStorage
        const syncResult = await this.callWithRateLimit(() => 
          wireframeAPIService.syncDatabaseToLocalStorage(projectId, token)
        );
        
        if (syncResult.success && syncResult.syncedCount > 0) {
          console.log(`✅ Auto-synced ${syncResult.syncedCount} wireframes from database`);
          
          const updatedWireframes = localStorageService.getWireframesByProject(projectId);
          return {
            success: true,
            syncedFromDb: true,
            message: `Auto-synced ${syncResult.syncedCount} wireframes from database`,
            wireframeCount: updatedWireframes.length
          };
        }
      }
      
      // If database empty or sync failed, check if we have local data to sync TO database
      const localWireframes = localStorageService.getWireframesByProject(projectId);
      if (localWireframes.length > 0) {
        console.log(`📤 Auto-syncing ${localWireframes.length} local wireframes to database...`);
        const uploadResult = await this.callWithRateLimit(() => 
          wireframeAPIService.syncLocalToDatabase(projectId, token)
        );
        
        return {
          success: uploadResult.success,
          syncedFromDb: false,
          message: uploadResult.message,
          wireframeCount: localWireframes.length
        };
      }
      
      // No wireframes anywhere
      return {
        success: true,
        syncedFromDb: false,
        message: 'No wireframes found to sync',
        wireframeCount: 0
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

  // ===== SYNC METHODS =====
  
  // Unified sync method for wireframes
  async syncWireframes(projectId: string, token?: string | null): Promise<{
    success: boolean;
    syncedFromDb: boolean;
    message: string;
    wireframeCount?: number;
  }> {
    // If no token, we're offline
    if (!token) {
      console.log('🟡 OFFLINE: No token, skipping database sync for wireframes');
      return {
        success: true,
        syncedFromDb: false,
        message: 'Offline mode - using local data only'
      };
    }

    try {
      console.log('🔄 Starting wireframes sync...');
      
      // First check if wireframes exist in database
      const checkResult = await this.callWithRateLimit(() => 
        wireframeAPIService.checkWireframesExist(projectId, token)
      );
      
      if (checkResult.success && checkResult.exists && checkResult.wireframe_count > 0) {
        // Database has wireframes, sync FROM database TO localStorage
        const syncResult = await this.callWithRateLimit(() => 
          wireframeAPIService.syncDatabaseToLocalStorage(projectId, token)
        );
        
        if (syncResult.success && syncResult.syncedCount > 0) {
          console.log(`✅ Synced ${syncResult.syncedCount} wireframes from database`);
          
          const updatedWireframes = localStorageService.getWireframesByProject(projectId);
          console.log(`📊 Now have ${updatedWireframes.length} wireframes in localStorage`);
          
          return {
            success: true,
            syncedFromDb: true,
            message: syncResult.message,
            wireframeCount: updatedWireframes.length
          };
        }
      }
      
      // If database empty or sync failed, check local data
      const localWireframes = localStorageService.getWireframesByProject(projectId);
      if (localWireframes.length > 0) {
        console.log(`📤 Syncing ${localWireframes.length} local wireframes to database...`);
        const uploadResult = await this.callWithRateLimit(() => 
          wireframeAPIService.syncLocalToDatabase(projectId, token)
        );
        
        return {
          success: uploadResult.success,
          syncedFromDb: false,
          message: uploadResult.message,
          wireframeCount: localWireframes.length
        };
      }
      
      // No wireframes anywhere
      return {
        success: true,
        syncedFromDb: false,
        message: 'No wireframes found in database or localStorage',
        wireframeCount: 0
      };
      
    } catch (error) {
      console.error('Wireframe sync failed:', error);
      return {
        success: false,
        syncedFromDb: false,
        message: `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Generate wireframes with sync logic
  async generateWireframesWithSync(projectId: string, token?: string | null, projectData?: LocalProject): Promise<{
    success: boolean;
    message: string;
    data?: LocalWireframe[];
    count?: number;
    source?: string;
    error?: string;
    autoSynced?: boolean;
  }> {
    try {
      const isAuthenticated = !!token;
      
      // STEP 1: Auto-sync on entry (if authenticated)
      if (isAuthenticated && token) {
        console.log('🔄 Authenticated: Performing auto-sync on entry...');
        const autoSyncResult = await this.callWithRateLimit(() => 
          this.autoSyncOnEntry(projectId, token)
        );
        
        if (autoSyncResult.success && autoSyncResult.syncedFromDb && autoSyncResult.wireframeCount && autoSyncResult.wireframeCount > 0) {
          // If we got data from database, return it
          console.log('✅ Using auto-synced wireframes from database');
          const wireframes = localStorageService.getWireframesByProject(projectId);
          return {
            success: true,
            message: `Auto-loaded ${wireframes.length} wireframes from database`,
            data: wireframes,
            count: wireframes.length,
            source: 'database',
            autoSynced: true
          };
        }
      }
      
      // STEP 2: Check if we already have wireframes locally
      const existingWireframes = localStorageService.getWireframesByProject(projectId);
      if (existingWireframes.length > 0) {
        console.log(`ℹ️ Found ${existingWireframes.length} existing local wireframes`);
        return {
          success: true,
          message: `Loaded ${existingWireframes.length} existing wireframes`,
          data: existingWireframes,
          count: existingWireframes.length,
          source: 'local_cache',
          autoSynced: false
        };
      }
      
      // STEP 3: If no wireframes exist, generate new ones
      console.log('🔄 No wireframes found, generating new...');
      
      if (isAuthenticated && token) {
        // Generate via API with rate limiting
        const generationResult = await this.callWithRateLimit(() => 
          this.generateWireframesOnline(projectId, token)
        );
        
        // STEP 4: Auto-sync to database after generation
        if (generationResult.success && generationResult.data && generationResult.data.length > 0) {
          console.log('🔄 Auto-syncing newly generated wireframes to database...');
          const autoSyncResult = await this.callWithRateLimit(() => 
            this.autoSyncAfterRegeneration(projectId, token, generationResult.data?.length || 0)
          );
          
          if (autoSyncResult.success) {
            console.log(`✅ Auto-synced ${autoSyncResult.syncedCount} wireframes to database`);
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
        
        const userStories = localStorageService.getUserStoriesByProject(projectId);
        if (!userStories || userStories.length === 0) {
          throw new Error('No user stories found. Generate user stories first.');
        }
        
        const wireframes = this.generateWireframesOffline(project, userStories);
        
        return {
          success: true,
          message: `Generated ${wireframes.length} wireframes locally`,
          data: wireframes,
          count: wireframes.length,
          source: 'offline_generated',
          autoSynced: false
        };
      }
      
    } catch (error) {
      console.error('Wireframe generation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error',
        autoSynced: false
      };
    }
  }

  // Two-way sync wireframes
  async twoWaySyncWireframes(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      console.log('🔄 Starting two-way wireframe sync...');
      
      const result = await this.callWithRateLimit(() => 
        wireframeAPIService.twoWaySyncWireframes(projectId, token)
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

  // Get sync status
  async getWireframeSyncStatus(projectId: string, token?: string | null): Promise<{
    success: boolean;
    sync_status: any;
    message: string;
  }> {
    if (!token) {
      const localWireframes = localStorageService.getWireframesByProject(projectId);
      return {
        success: true,
        sync_status: {
          is_synced: true,
          database: { wireframe_count: 0, last_updated: null },
          local: { 
            wireframe_count: localWireframes.length,
            last_updated: localWireframes.length > 0 
              ? new Date(Math.max(...localWireframes.map(w => new Date(w.updated_at || w.created_at).getTime()))).toISOString()
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
        wireframeAPIService.getWireframeSyncStatus(projectId, token)
      );
    } catch (error) {
      console.error('Error getting sync status:', error);
      const localWireframes = localStorageService.getWireframesByProject(projectId);
      return {
        success: false,
        sync_status: {
          is_synced: false,
          database: { wireframe_count: 0, last_updated: null },
          local: { 
            wireframe_count: localWireframes.length,
            last_updated: localWireframes.length > 0 
              ? new Date(Math.max(...localWireframes.map(w => new Date(w.updated_at || w.created_at).getTime()))).toISOString()
              : null
          },
          needs_sync: false,
          mode: 'error'
        },
        message: `Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  // Get wireframes with enhanced display data for the UI
  async getWireframesForDisplay(projectId: string): Promise<EnhancedWireframe[]> {
    try {
      const wireframes = localStorageService.getWireframesByProject(projectId);
      
      return wireframes.map(wireframe => this.enhanceWireframeWithDisplayData(wireframe));
    } catch (error) {
      console.error('Error getting wireframes for display:', error);
      return [];
    }
  }

  // Get detailed wireframe information including full LLM response
  async getWireframeDetails(wireframeId: string): Promise<EnhancedWireframe> {
    try {
      const allWireframes = localStorageService.getAllWireframes();
      const wireframe = allWireframes.find(wf => wf.wireframe_id === wireframeId);
      
      if (!wireframe) {
        throw new Error(`Wireframe with ID ${wireframeId} not found`);
      }

      return this.enhanceWireframeWithDisplayData(wireframe, true);
    } catch (error) {
      console.error('Error getting wireframe details:', error);
      throw error;
    }
  }

  // Enhance wireframe with display and debug information
  private enhanceWireframeWithDisplayData(wireframe: LocalWireframe, includeFullResponse: boolean = false): EnhancedWireframe {
    const htmlContent = wireframe.html_content || '';
    const hasValidStructure = this.validateHTMLStructure(htmlContent);
    
    const llmResponsePreview = this.extractLLMResponsePreview(wireframe);
    const usedRag = wireframe.generated_with_rag || false;
    const usedFallback = !usedRag && (wireframe.is_local || false);
    
    const uiPatternsUsed = this.countUIPatterns(htmlContent);
    const projectPatternsUsed = this.countProjectPatterns(wireframe);
    
    const enhancedWireframe: EnhancedWireframe = {
      ...wireframe,
      display_data: {
        page_name: wireframe.page_name,
        page_type: wireframe.page_type,
        html_preview: this.generateHTMLPreview(htmlContent),
        has_valid_structure: hasValidStructure,
        stories_count: wireframe.stories_count || 0,
        features_count: wireframe.features_count || 0,
        generated_at: wireframe.generated_at || wireframe.created_at,
        debug_status: hasValidStructure ? 'success' : 'invalid_html',
        llm_response_preview: llmResponsePreview,
        llm_response_length: llmResponsePreview.length,
        html_length: htmlContent.length,
        used_rag: usedRag,
        used_fallback: usedFallback,
        generation_error: this.extractGenerationError(wireframe),
        ui_patterns_used: uiPatternsUsed,
        project_patterns_used: projectPatternsUsed
      }
    };
    
    if (includeFullResponse) {
      enhancedWireframe.full_llm_response = this.extractFullLLMResponse(wireframe);
    }
    
    return enhancedWireframe;
  }

  // Unified method that handles both online and offline modes
  async generateWireframes(projectId: string, projectData?: LocalProject): Promise<{
    success: boolean;
    message: string;
    data?: LocalWireframe[];
    count?: number;
    error?: string;
  }> {
    const isAuthenticated = !!localStorage.getItem('access_token');
    
    if (isAuthenticated) {
      console.log('🟢 ONLINE MODE: Using authenticated API for wireframes');
      return await this.callWithRateLimit(() => 
        this.generateWireframesOnline(projectId)
      );
    } else {
      console.log('🟡 OFFLINE MODE: Using local project API for wireframes');
      return await this.generateWireframesOfflineAPI(projectId, projectData);
    }
  }

  // Generate wireframes via API (authenticated)
  async generateWireframesOnline(projectId: string, token?: string): Promise<{
    success: boolean;
    message: string;
    data?: LocalWireframe[];
    count?: number;
    error?: string;
  }> {
    try {
      console.log('Attempting to generate wireframes for project:', projectId);

      const authToken = token || localStorage.getItem('access_token');
      if (!authToken) {
        console.warn('No authentication token found, using offline mode');
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/projects/${projectId}/generate-wireframes/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      console.log('Wireframe API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Wireframe API Error:', errorText);
        
        // Check if it's a rate limit error
        if (response.status === 429) {
          throw { 
            status: 429, 
            message: 'Rate limited by server. Please try again later.' 
          };
        }
        
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('Wireframe API Response data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Wireframe generation failed on server');
      }

      // Save wireframes to localStorage for consistency
      if (data.wireframes && Array.isArray(data.wireframes)) {
        this.saveWireframesToLocalStorage(data.wireframes, projectId);
      }

      return {
        success: true,
        message: data.message || 'Wireframes generated successfully',
        data: data.wireframes || [],
        count: data.wireframes ? data.wireframes.length : 0
      };
    } catch (error) {
      console.error('Error generating wireframes online:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generate wireframes via API for local projects (no auth required)
  async generateWireframesOfflineAPI(projectId: string, projectData?: LocalProject): Promise<{
    success: boolean;
    message: string;
    data?: LocalWireframe[];
    count?: number;
    error?: string;
  }> {
    try {
      console.log('🔄 Generating wireframes for local project via API:', projectId);

      const project = projectData || localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found in localStorage');
      }

      const userStories = localStorageService.getUserStoriesByProject(projectId);
      if (!userStories || userStories.length === 0) {
        throw new Error('No user stories found. Generate user stories first.');
      }

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

      const userStoriesData = userStories.map(story => ({
        story_id: story.story_id,
        story_text: story.story_text,
        role: story.role,
        action: story.action,
        benefit: story.benefit,
        feature: story.feature,
        acceptance_criteria: story.acceptance_criteria,
        priority: story.priority,
        story_points: story.story_points,
        status: story.status,
        generated_by_llm: story.generated_by_llm
      }));

      console.log('Sending data to local wireframe API:', {
        project: apiProjectData.title,
        stories_count: userStoriesData.length
      });

      const response = await fetch('/api/local-projects/generate-wireframes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          project_data: apiProjectData,
          user_stories: userStoriesData,
          project_id: projectId 
        })
      });

      console.log('Local Wireframe API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Local Wireframe API Error:', errorText);
        throw new Error(`Local API error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('Local Wireframe API Response data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Local wireframe generation failed on server');
      }

      if (data.wireframes && Array.isArray(data.wireframes)) {
        this.saveWireframesToLocalStorage(data.wireframes, projectId);
        console.log(`✅ Saved ${data.wireframes.length} wireframes to localStorage`);
      }

      return {
        success: true,
        message: data.message || 'Wireframes generated successfully',
        data: data.wireframes || [],
        count: data.wireframes ? data.wireframes.length : 0
      };
    } catch (error) {
      console.error('Error generating wireframes via local API:', error);
      
      console.log('🔄 Falling back to template-based wireframe generation');
      return this.generateWireframesOfflineFallback(projectId);
    }
  }

  // Fallback to template generation when API fails
  private async generateWireframesOfflineFallback(projectId: string): Promise<{
    success: boolean;
    message: string;
    data?: LocalWireframe[];
    count?: number;
    error?: string;
  }> {
    try {
      const project = localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found in localStorage');
      }

      const userStories = localStorageService.getUserStoriesByProject(projectId);
      if (!userStories || userStories.length === 0) {
        throw new Error('No user stories found for fallback generation');
      }

      const wireframes = this.generateWireframesOffline(project, userStories);
      
      return {
        success: true,
        message: `Generated ${wireframes.length} wireframes using templates`,
        data: wireframes,
        count: wireframes.length
      };
    } catch (error) {
      console.error('Template wireframe generation also failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generate wireframes offline (template-based)
  generateWireframesOffline(project: LocalProject, userStories: LocalUserStory[]): LocalWireframe[] {
    console.log('Generating wireframes offline for project:', project.title);

    const storiesByRole: Record<string, LocalUserStory[]> = {};
    userStories.forEach(story => {
      if (!storiesByRole[story.role]) {
        storiesByRole[story.role] = [];
      }
      storiesByRole[story.role].push(story);
    });

    const wireframes: LocalWireframe[] = [];

    for (const [role, stories] of Object.entries(storiesByRole)) {
      const pageName = `${role.toLowerCase().replace(' ', '-')}-page`;
      const pageType = this.determinePageType(pageName);
      
      const htmlContent = this.createBasicWireframeHTML(project, role, stories);
      
      const wireframeData: CreateLocalWireframe = {
        project_id: project.project_id,
        page_name: pageName,
        page_type: pageType,
        description: `${role} interface for ${project.title}`,
        html_content: htmlContent,
        creole_content: this.generateCreoleDocumentation(project, role, stories),
        salt_diagram: this.generateSaltUML(project, role, stories),
        generated_with_rag: false,
        wireframe_type: 'desktop',
        version: 1,
        preview_url: '',
        stories_count: stories.length,
        features_count: new Set(stories.map(s => s.feature)).size,
        generated_at: new Date().toISOString(),
        is_local: true
      };

      // Pass wireframe_id as second parameter
      const createdWireframe = localStorageService.createWireframe(wireframeData, Date.now().toString());
      wireframes.push(createdWireframe);
    }

    console.log(`Generated ${wireframes.length} wireframes offline`);
    return wireframes;
  }

  // Save wireframes to localStorage - FIXED to match LocalWireframe interface
  private saveWireframesToLocalStorage(apiWireframes: any[], projectId: string): void {
    try {
      console.log('💾 Saving wireframes to localStorage');
      
      const existingWireframes = localStorageService.getWireframesByProject(projectId);
      existingWireframes.forEach(wireframe => {
        this.deleteWireframeLocal(wireframe.wireframe_id);
      });

      apiWireframes.forEach((apiWireframe: any) => {
        const wireframeData: CreateLocalWireframe = {
          project_id: projectId,
          page_name: apiWireframe.page_name || 'unnamed-page',
          page_type: this.determinePageType(apiWireframe.page_name),
          description: apiWireframe.description || `Wireframe for ${apiWireframe.page_name}`,
          html_content: apiWireframe.html_content || '',
          creole_content: apiWireframe.creole_documentation || apiWireframe.creole_content || '',
          salt_diagram: apiWireframe.salt_uml || apiWireframe.salt_diagram || '',
          generated_with_rag: apiWireframe.used_rag_patterns || false,
          wireframe_type: 'desktop',
          version: 1,
          preview_url: apiWireframe.preview_url || '',
          stories_count: apiWireframe.stories_count || 0,
          features_count: apiWireframe.features_count || 0,
          generated_at: apiWireframe.generated_at || new Date().toISOString(),
          is_local: true
        };

        localStorageService.createWireframe(wireframeData, apiWireframe.wireframe_id || Date.now().toString());
      });
      
      console.log(`✅ Successfully saved ${apiWireframes.length} wireframes to localStorage`);
    } catch (error) {
      console.error('Failed to save wireframes to localStorage:', error);
    }
  }

  // Helper method to delete wireframe locally
  private deleteWireframeLocal(wireframeId: string): void {
    try {
      const wireframesJson = localStorage.getItem('wireframes');
      if (!wireframesJson) return;

      const wireframes: LocalWireframe[] = JSON.parse(wireframesJson);
      const filteredWireframes = wireframes.filter(wf => wf.wireframe_id !== wireframeId);
      
      localStorage.setItem('wireframes', JSON.stringify(filteredWireframes));
    } catch (error) {
      console.error('Error deleting wireframe locally:', error);
    }
  }

  // Helper method to determine page type from page name
  private determinePageType(pageName: string): LocalWireframe['page_type'] {
    const pageNameLower = pageName.toLowerCase();
    
    if (pageNameLower.includes('login') || pageNameLower.includes('auth')) return 'login';
    if (pageNameLower.includes('dashboard') || pageNameLower.includes('home')) return 'dashboard';
    if (pageNameLower.includes('profile') || pageNameLower.includes('account')) return 'profile';
    if (pageNameLower.includes('product') || pageNameLower.includes('catalog')) return 'products';
    if (pageNameLower.includes('cart') || pageNameLower.includes('basket')) return 'cart';
    if (pageNameLower.includes('checkout') || pageNameLower.includes('payment')) return 'checkout';
    if (pageNameLower.includes('search') || pageNameLower.includes('find')) return 'search';
    if (pageNameLower.includes('admin') || pageNameLower.includes('manage')) return 'admin';
    
    return 'general';
  }

  // ===== HELPER METHODS FOR DISPLAY DATA =====

  private validateHTMLStructure(htmlContent: string): boolean {
    if (!htmlContent || htmlContent.trim().length === 0) return false;
    
    const hasHTMLTag = htmlContent.includes('<html') || htmlContent.includes('<!DOCTYPE');
    const hasBodyTag = htmlContent.includes('<body');
    const hasHeadTag = htmlContent.includes('<head');
    
    if (!hasHTMLTag && !hasBodyTag) {
      const hasAnyHTMLElements = /<[a-z][\s\S]*>/i.test(htmlContent);
      return hasAnyHTMLElements;
    }
    
    return hasHTMLTag || (hasBodyTag && hasHeadTag);
  }

  private extractLLMResponsePreview(wireframe: LocalWireframe): string {
    if (wireframe.creole_content && wireframe.creole_content.length > 0) {
      return wireframe.creole_content.substring(0, 200) + '...';
    }
    
    if (wireframe.salt_diagram && wireframe.salt_diagram.length > 0) {
      return `Salt UML: ${wireframe.salt_diagram.substring(0, 150)}...`;
    }
    
    if (wireframe.description && wireframe.description.length > 0) {
      return `Description: ${wireframe.description.substring(0, 150)}...`;
    }
    
    return 'No LLM response data available';
  }

  private extractFullLLMResponse(wireframe: LocalWireframe): string {
    const parts = [];
    
    if (wireframe.creole_content) {
      parts.push(`=== Creole Documentation ===\n${wireframe.creole_content}`);
    }
    
    if (wireframe.salt_diagram) {
      parts.push(`=== Salt UML Diagram ===\n${wireframe.salt_diagram}`);
    }
    
    if (wireframe.description) {
      parts.push(`=== Description ===\n${wireframe.description}`);
    }
    
    return parts.join('\n\n') || 'No detailed LLM response data available';
  }

  private extractGenerationError(wireframe: LocalWireframe): string | undefined {
    const html = wireframe.html_content || '';
    
    if (html.includes('error') || html.includes('Exception') || html.includes('Failed')) {
      const errorMatch = html.match(/(error|exception|failed)[^<]*/i);
      return errorMatch ? errorMatch[0] : 'Generation error detected in output';
    }
    
    return undefined;
  }

  private generateHTMLPreview(htmlContent: string): string {
    if (!htmlContent) return 'No HTML content';
    
    const textOnly = htmlContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textOnly.substring(0, 100) + (textOnly.length > 100 ? '...' : '');
  }

  private countUIPatterns(htmlContent: string): number {
    if (!htmlContent) return 0;
    
    const patterns = [
      /<form[^>]*>/gi,
      /<input[^>]*>/gi,
      /<button[^>]*>/gi,
      /<nav[^>]*>/gi,
      /<table[^>]*>/gi,
      /<div class="[^"]*container[^"]*"/gi,
      /<div class="[^"]*card[^"]*"/gi,
      /<div class="[^"]*modal[^"]*"/gi
    ];
    
    return patterns.reduce((count, pattern) => {
      const matches = htmlContent.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private countProjectPatterns(wireframe: LocalWireframe): number {
    let count = 0;
    
    if (wireframe.stories_count && wireframe.stories_count > 0) count++;
    if (wireframe.features_count && wireframe.features_count > 0) count++;
    if (wireframe.generated_with_rag) count++;
    if (wireframe.creole_content && wireframe.creole_content.length > 10) count++;
    if (wireframe.salt_diagram && wireframe.salt_diagram.length > 10) count++;
    
    return count;
  }

  // Helper methods for template generation
  private createBasicWireframeHTML(project: LocalProject, role: string, stories: LocalUserStory[]): string {
    const storiesList = stories.map(story => 
      `<div class="story-item">
        <h4>${story.story_text}</h4>
        <p><strong>Feature:</strong> ${story.feature} | <strong>Priority:</strong> ${story.priority}</p>
      </div>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${role} Page - ${project.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: #4699DF; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .story-item { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, textarea, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        .btn { background: #4699DF; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${role} Dashboard</h1>
            <p>${project.title} - ${role} Interface</p>
        </div>
        
        <section class="stories-section">
            <h2>User Stories</h2>
            ${storiesList}
        </section>
        
        <section class="interaction-section">
            <h2>Main Interface</h2>
            <form>
                <div class="form-group">
                    <label for="action">Primary Action:</label>
                    <select id="action">
                        <option value="">Select an action</option>
                        ${stories.map(story => `<option value="${story.action}">${story.action}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="data">Data Input:</label>
                    <textarea id="data" rows="3" placeholder="Enter relevant data..."></textarea>
                </div>
                <button type="submit" class="btn">Submit</button>
            </form>
        </section>
    </div>
</body>
</html>`;
  }

  private generateCreoleDocumentation(project: LocalProject, role: string, stories: LocalUserStory[]): string {
    return `= ${role} Page Documentation
== Overview
This page serves the ${role} role in the ${project.title} system.

== User Stories
${stories.map((story, index) => 
  `${index + 1}. ${story.story_text}
   * Feature: ${story.feature}
   * Priority: ${story.priority}
   * Points: ${story.story_points}`
).join('\n\n')}

== Interface Elements
* Main navigation area
* User story display section
* Action form for primary interactions
* Data input fields
* Submission controls`;
  }

  private generateSaltUML(project: LocalProject, role: string, stories: LocalUserStory[]): string {
    return `@startuml
actor "${role}" as User
package "${role} Page" {
  [Story Display] as Stories
  [Action Form] as Form
  [Data Input] as Input
  [Submit Handler] as Submit
}

User --> Stories : views stories
User --> Form : selects action
User --> Input : enters data
Input --> Submit : processes
Submit --> [System] : sends data

@enduml`;
  }
}

export { WireframeService };