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
  
  // Rate limiting configuration - ALIGNED WITH REPLICATE'S FREE TIER
  private readonly RATE_LIMIT_CONFIG = {
    maxRequestsPerMinute: 5, // Reduced to be safe
    minDelayBetweenRequests: 12000, // 12 seconds minimum between requests
    burstLimit: 1, // Only 1 burst request allowed
    maxRetries: 10, // INCREASED RETRIES: Keep retrying on rate limits
    retryDelayBase: 10000, // Start with 10 seconds delay
    retryDelayMax: 60000, // Max 60 seconds delay
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
    
    // Clean up old requests
    this.requestQueue = this.requestQueue.filter(req => req.timestamp > oneMinuteAgo);
    
    // If we've reached the minute limit, wait for the oldest request to age out
    if (this.requestQueue.length >= this.RATE_LIMIT_CONFIG.maxRequestsPerMinute) {
      const oldestRequest = this.requestQueue[0];
      const timeToWait = Math.max(0, (oldestRequest.timestamp + 60000) - now);
      
      if (timeToWait > 0) {
        console.log(`⏳ Rate limit reached (${this.requestQueue.length}/${this.RATE_LIMIT_CONFIG.maxRequestsPerMinute}). Waiting ${Math.ceil(timeToWait / 1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait + 1000));
      }
    }
    
    // Check burst limit (last 5 seconds)
    const fiveSecondsAgo = now - 5000;
    const recentBurstRequests = this.requestQueue.filter(req => req.timestamp > fiveSecondsAgo);
    
    if (recentBurstRequests.length >= this.RATE_LIMIT_CONFIG.burstLimit) {
      const delay = this.RATE_LIMIT_CONFIG.minDelayBetweenRequests;
      console.log(`⏳ Burst limit reached. Waiting ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Add this request to the queue
    this.requestQueue.push({
      timestamp: Date.now(),
      projectId: '',
      pageName: '',
    });
  }

  private async callWithRateLimit<T>(
    apiCall: () => Promise<T>,
    operationName: string = 'API call',
    retryCount: number = 0
  ): Promise<T> {
    try {
      await this.waitForRateLimit();
      console.log(`🔄 ${operationName} attempt ${retryCount + 1}`);
      return await apiCall();
    } catch (error: any) {
      // Handle rate limiting (429 errors)
      if (error.status === 429 || (error.message && error.message.includes('429')) || 
          (error.message && error.message.includes('throttled'))) {
        
        if (retryCount >= this.RATE_LIMIT_CONFIG.maxRetries) {
          console.error(`❌ Max retries (${this.RATE_LIMIT_CONFIG.maxRetries}) reached for ${operationName}`);
          throw new Error(`Rate limit exceeded after ${this.RATE_LIMIT_CONFIG.maxRetries} retries. Please wait a moment and try again.`);
        }
        
        // Exponential backoff with jitter
        const baseDelay = this.RATE_LIMIT_CONFIG.retryDelayBase;
        const maxDelay = this.RATE_LIMIT_CONFIG.retryDelayMax;
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
        const jitter = Math.random() * 1000; // Add up to 1 second jitter
        const waitTime = exponentialDelay + jitter;
        
        console.log(`🔄 Rate limited on ${operationName}. Retry ${retryCount + 1}/${this.RATE_LIMIT_CONFIG.maxRetries} in ${Math.ceil(waitTime / 1000)}s`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Clear queue to reset rate limit tracking
        this.requestQueue = this.requestQueue.slice(-2); // Keep only last 2 requests
        
        return this.callWithRateLimit(apiCall, operationName, retryCount + 1);
      }
      
      // Handle timeouts
      if (error.message && (error.message.includes('timeout') || error.message.includes('timed out'))) {
        if (retryCount >= 3) { // Max 3 retries for timeouts
          throw new Error(`Operation timed out after ${retryCount + 1} attempts`);
        }
        
        const timeoutDelay = 5000 * (retryCount + 1);
        console.log(`⏳ Timeout on ${operationName}. Retry ${retryCount + 1}/3 in ${timeoutDelay / 1000}s`);
        await new Promise(resolve => setTimeout(resolve, timeoutDelay));
        return this.callWithRateLimit(apiCall, operationName, retryCount + 1);
      }
      
      // For other errors, throw immediately (no retry)
      throw error;
    }
  }

  // ===== NO FALLBACK GENERATION METHODS =====

  async generateWireframesOnlineWithRetry(
    projectId: string, 
    token: string, 
    maxRetries: number = 10
  ): Promise<{
    success: boolean;
    message: string;
    data?: LocalWireframe[];
    count?: number;
    error?: string;
  }> {
    console.log('🚀 Starting LLM-based wireframe generation with NO FALLBACK...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Generation attempt ${attempt}/${maxRetries}`);
        
        const result = await this.callWithRateLimit(
          () => this.generateWireframesOnline(projectId, token),
          'Wireframe generation',
          attempt - 1
        );
        
        if (result.success) {
          console.log(`✅ Wireframe generation successful on attempt ${attempt}`);
          return result;
        }
        
        // If not successful but not due to rate limiting, try again
        console.log(`🔄 Generation attempt ${attempt} failed: ${result.message}`);
        
        // Wait between attempts
        if (attempt < maxRetries) {
          const waitTime = 5000 * attempt; // Exponential backoff: 5s, 10s, 15s...
          console.log(`⏳ Waiting ${waitTime / 1000}s before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
      } catch (error) {
        console.error(`❌ Generation attempt ${attempt} error:`, error);
        
        if (attempt === maxRetries) {
          throw new Error(`Wireframe generation failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Wait before retry
        const waitTime = 5000 * attempt;
        console.log(`⏳ Waiting ${waitTime / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw new Error(`Wireframe generation failed after ${maxRetries} attempts`);
  }

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
      
      if (isAuthenticated && token) {
        console.log('🔄 Authenticated: Performing auto-sync on entry...');
        const autoSyncResult = await this.callWithRateLimit(() => 
          this.autoSyncOnEntry(projectId, token)
        );
        
        if (autoSyncResult.success && autoSyncResult.syncedFromDb && autoSyncResult.wireframeCount && autoSyncResult.wireframeCount > 0) {
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
      
      console.log('🚀 NO wireframes found. Starting LLM-based generation WITHOUT FALLBACK...');
      
      if (isAuthenticated && token) {
        // USE THE NO-FALLBACK VERSION
        const generationResult = await this.generateWireframesOnlineWithRetry(projectId, token);
        
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
        // OFFLINE MODE - USE LOCAL API WITH RETRIES (NO TEMPLATE FALLBACK)
        console.log('🟡 Offline mode: Using local API with retries');
        const generationResult = await this.generateWireframesOfflineAPIWithRetry(projectId, projectData);
        
        return {
          ...generationResult,
          autoSynced: false
        };
      }
      
    } catch (error) {
      console.error('❌ Wireframe generation failed completely (NO FALLBACK):', error);
      return {
        success: false,
        message: `LLM-based generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        autoSynced: false
      };
    }
  }

  async generateWireframesOfflineAPIWithRetry(
    projectId: string, 
    projectData?: LocalProject,
    maxRetries: number = 10
  ): Promise<{
    success: boolean;
    message: string;
    data?: LocalWireframe[];
    count?: number;
    error?: string;
  }> {
    console.log('🚀 Starting local API wireframe generation with NO FALLBACK...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Local API generation attempt ${attempt}/${maxRetries}`);
        
        const result = await this.callWithRateLimit(
          () => this.generateWireframesOfflineAPI(projectId, projectData),
          'Local API wireframe generation',
          attempt - 1
        );
        
        if (result.success) {
          console.log(`✅ Local API wireframe generation successful on attempt ${attempt}`);
          return result;
        }
        
        console.log(`🔄 Local API generation attempt ${attempt} failed: ${result.message}`);
        
        if (attempt < maxRetries) {
          const waitTime = 5000 * attempt;
          console.log(`⏳ Waiting ${waitTime / 1000}s before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
      } catch (error) {
        console.error(`❌ Local API generation attempt ${attempt} error:`, error);
        
        if (attempt === maxRetries) {
          throw new Error(`Local API wireframe generation failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        const waitTime = 5000 * attempt;
        console.log(`⏳ Waiting ${waitTime / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw new Error(`Local API wireframe generation failed after ${maxRetries} attempts`);
  }

  async autoSyncAfterRegeneration(projectId: string, token: string, newlyGeneratedCount: number): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      console.log(`🔄 Auto-syncing ${newlyGeneratedCount} newly generated wireframes to database...`);
      
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
      
      const checkResult = await this.callWithRateLimit(() => 
        wireframeAPIService.checkWireframesExist(projectId, token)
      );
      
      if (checkResult.success && checkResult.exists && checkResult.wireframe_count > 0) {
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
  
  async syncWireframes(projectId: string, token?: string | null): Promise<{
    success: boolean;
    syncedFromDb: boolean;
    message: string;
    wireframeCount?: number;
  }> {
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
      
      const checkResult = await this.callWithRateLimit(() => 
        wireframeAPIService.checkWireframesExist(projectId, token)
      );
      
      if (checkResult.success && checkResult.exists && checkResult.wireframe_count > 0) {
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

  // REMOVED THE OLD generateWireframes METHOD THAT HAD FALLBACK
  // Use generateWireframesWithSync instead

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
        console.warn('No authentication token found');
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
      throw error; // RE-THROW instead of returning error - let caller handle retries
    }
  }

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
        console.log(`✅ Saved ${data.wireframes.length} wireframes to local_wireframes`);
      }

      return {
        success: true,
        message: data.message || 'Wireframes generated successfully',
        data: data.wireframes || [],
        count: data.wireframes ? data.wireframes.length : 0
      };
    } catch (error) {
      console.error('Error generating wireframes via local API:', error);
      throw error; // RE-THROW instead of falling back
    }
  }

  // REMOVED: generateWireframesOfflineFallback method
  // REMOVED: generateWireframesOffline method 
  // REMOVED: createBasicWireframeHTML, generateCreoleDocumentation, generateSaltUML methods

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
  
  async getWireframesForDisplay(projectId: string): Promise<EnhancedWireframe[]> {
    try {
      const wireframes = localStorageService.getWireframesByProject(projectId);
      
      return wireframes.map(wireframe => this.enhanceWireframeWithDisplayData(wireframe));
    } catch (error) {
      console.error('Error getting wireframes for display:', error);
      return [];
    }
  }

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

  // Save wireframes to localStorage - FIXED TO USE ONLY local_wireframes
  private saveWireframesToLocalStorage(apiWireframes: any[], projectId: string): void {
    try {
      console.log('💾 Saving wireframes to local_wireframes only...');
      
      // Clear existing wireframes for this project
      localStorageService.clearProjectWireframes(projectId);

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

        const wireframeId = apiWireframe.wireframe_id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        localStorageService.createWireframe(wireframeData, wireframeId);
      });
      
      console.log(`✅ Successfully saved ${apiWireframes.length} wireframes to local_wireframes only`);
      
      const savedWireframes = localStorageService.getWireframesByProject(projectId);
      console.log(`📊 Verified: ${savedWireframes.length} wireframes now in local_wireframes for project ${projectId}`);
      
    } catch (error) {
      console.error('Failed to save wireframes to localStorage:', error);
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
}

export { WireframeService };