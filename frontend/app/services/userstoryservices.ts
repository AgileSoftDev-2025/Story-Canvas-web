// frontend/app/services/userstoryservices.ts
import { localStorageService } from "../utils/localStorageService";
import type { LocalUserStory, LocalProject } from "../utils/localStorageModels";

class UserStoryAPIService {
  private static instance: UserStoryAPIService;

  public static getInstance(): UserStoryAPIService {
    if (!UserStoryAPIService.instance) {
      UserStoryAPIService.instance = new UserStoryAPIService();
    }
    return UserStoryAPIService.instance;
  }

  // Get user stories from database API
  async fetchUserStoriesFromDatabase(projectId: string, token: string): Promise<any> {
    try {
      console.log(`📡 Fetching user stories from database for project: ${projectId}`);
      
      const response = await fetch(`/api/projects/${projectId}/user-stories-sync/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Database API Response status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('No user stories found in database');
          return { success: true, data: [], count: 0 };
        }
        
        const errorText = await response.text();
        console.error('Database API Error:', errorText);
        throw new Error(`Database error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Error fetching user stories from database:', error);
      throw error;
    }
  }

  // Sync project from database to localStorage
  async syncProjectFromDatabase(projectId: string, token: string): Promise<{
    success: boolean;
    project?: LocalProject;
    message: string;
  }> {
    try {
      console.log(`🔄 Syncing project from database: ${projectId}`);
      
      const response = await fetch(`/api/projects/${projectId}/sync-project/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            message: 'Project not found in database'
          };
        }
        
        const errorText = await response.text();
        throw new Error(`Database error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      
      if (data.success && data.project) {
        // Get user ID from current user or use placeholder
        const currentUser = localStorageService.getCurrentUser();
        const userId = currentUser?.id || 'user_' + Date.now();
        
        // Create project with the database project_id
        const createdProject = localStorageService.createProjectWithId({
          project_id: projectId, // Use database project_id
          user_id: userId,
          title: data.project.title,
          objective: data.project.objective || '',
          scope: data.project.scope || '',
          flow: data.project.flow || '',
          additional_info: data.project.additional_info || '',
          domain: data.project.domain || 'general',
          language: data.project.language || 'en',
          users_data: data.project.users_data || [],
          features_data: data.project.features_data || [],
          nlp_analysis: data.project.nlp_analysis || {},
          status: (data.project.status as 'draft' | 'in_progress' | 'completed') || 'draft',
          is_guest_project: false, // Database projects are not guest projects
          user_specific: true // Database projects are user-specific
        });
        
        console.log(`✅ Created project in localStorage: ${createdProject.project_id}`);
        
        return {
          success: true,
          project: createdProject,
          message: 'Project synced from database to localStorage'
        };
      }
      
      throw new Error(data.error || 'Failed to sync project');
      
    } catch (error) {
      console.error('Error syncing project from database:', error);
      return {
        success: false,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Sync database stories to localStorage
  async syncDatabaseToLocalStorage(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      // 1. Fetch from database
      const dbResult = await this.fetchUserStoriesFromDatabase(projectId, token);
      
      if (!dbResult.success || !dbResult.data) {
        return {
          success: false,
          syncedCount: 0,
          message: dbResult.error || 'Failed to fetch from database'
        };
      }

      const dbStories = dbResult.data;
      console.log(`🔍 Found ${dbStories.length} stories in database`);
      
      if (dbStories.length === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: 'No stories in database to sync'
        };
      }

      // 2. Clear existing local stories for this project
      localStorageService.clearProjectStories(projectId);
      console.log(`🧹 Cleared existing local stories for project ${projectId}`);

      // 3. Convert database stories to localStorage format and save
      let savedCount = 0;
      dbStories.forEach((dbStory: any) => {
        try {
          const localStory: Omit<LocalUserStory, 'story_id' | 'created_at' | 'updated_at'> = {
            project_id: projectId,
            story_text: dbStory.story_text || '',
            role: dbStory.role || 'User',
            action: dbStory.action || this.extractActionFromStory(dbStory.story_text || ''),
            benefit: dbStory.benefit || this.extractBenefitFromStory(dbStory.story_text || ''),
            feature: dbStory.feature || 'General',
            acceptance_criteria: dbStory.acceptance_criteria || [],
            priority: (dbStory.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
            story_points: dbStory.story_points || 0,
            status: (dbStory.status as 'draft' | 'reviewed' | 'approved' | 'implemented') || 'draft',
            generated_by_llm: dbStory.generated_by_llm || false,
            iteration: dbStory.iteration || 1
          };

          const savedStory = localStorageService.createUserStory(localStory, dbStory.story_id);
          if (savedStory) savedCount++;
        } catch (err) {
          console.error(`Error converting story ${dbStory.story_id}:`, err);
        }
      });

      console.log(`✅ Successfully synced ${savedCount} stories to localStorage`);
      
      // Save sync timestamp
      this.setLastSyncTime(projectId);
      
      return {
        success: true,
        syncedCount: savedCount,
        message: `Synced ${savedCount} stories from database to localStorage`
      };

    } catch (error) {
      console.error('Error syncing database to localStorage:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Sync local stories to database
  async syncLocalToDatabase(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      const localStories = localStorageService.getUserStoriesByProject(projectId);
      
      if (localStories.length === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: 'No local stories to sync'
        };
      }

      console.log(`📤 Syncing ${localStories.length} local stories to database...`);

      let syncedCount = 0;
      let errors: string[] = [];

      // Sync each story individually
      for (const localStory of localStories) {
        try {
          const storyData = {
            project_id: projectId,
            story_text: localStory.story_text,
            role: localStory.role,
            action: localStory.action,
            benefit: localStory.benefit,
            feature: localStory.feature,
            acceptance_criteria: localStory.acceptance_criteria,
            priority: localStory.priority,
            story_points: localStory.story_points,
            status: localStory.status,
            generated_by_llm: localStory.generated_by_llm,
            iteration: localStory.iteration
          };

          // Try to update existing story first
          const updateResponse = await fetch(`/api/user-stories/update-api/${localStory.story_id}/`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(storyData)
          });

          if (updateResponse.ok) {
            console.log(`✅ Updated story ${localStory.story_id} in database`);
            syncedCount++;
            continue;
          }

          // If update failed (404), try to create new
          if (updateResponse.status === 404) {
            const createResponse = await fetch('/api/user-stories/create-api/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                ...storyData,
                story_id: localStory.story_id
              })
            });

            if (createResponse.ok) {
              const result = await createResponse.json();
              console.log(`✅ Created story ${localStory.story_id} in database`);
              syncedCount++;
            } else {
              const errorText = await createResponse.text();
              errors.push(`Failed to create story ${localStory.story_id}: ${errorText}`);
            }
          } else {
            const errorText = await updateResponse.text();
            errors.push(`Failed to update story ${localStory.story_id}: ${errorText}`);
          }
        } catch (err) {
          console.error(`Error syncing story ${localStory.story_id}:`, err);
          errors.push(`Error syncing story ${localStory.story_id}: ${err}`);
        }
      }

      if (errors.length > 0) {
        console.warn(`Sync completed with ${errors.length} errors:`, errors);
      }

      // Save sync timestamp
      if (syncedCount > 0) {
        this.setLastSyncTime(projectId);
      }

      return {
        success: errors.length === 0,
        syncedCount,
        message: errors.length === 0 
          ? `Successfully synced ${syncedCount} stories to database`
          : `Synced ${syncedCount} stories with ${errors.length} errors`
      };

    } catch (error) {
      console.error('Error syncing local to database:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get last sync timestamp
  getLastSyncTime(projectId: string): string | null {
    const key = `user_stories_sync_${projectId}`;
    return localStorage.getItem(key);
  }

  // Set last sync timestamp
  setLastSyncTime(projectId: string): void {
    const key = `user_stories_sync_${projectId}`;
    localStorage.setItem(key, new Date().toISOString());
  }

  // Helper methods
  private extractActionFromStory(storyText: string): string {
    if (!storyText) return 'use the system';
    if (storyText.includes('I want to')) {
      const actionPart = storyText.split('I want to')[1];
      if (actionPart.includes('so that')) {
        return actionPart.split('so that')[0].trim();
      }
      return actionPart.trim();
    }
    return 'use the system';
  }

  private extractBenefitFromStory(storyText: string): string {
    if (!storyText) return 'achieve goals';
    if (storyText.includes('so that')) {
      return storyText.split('so that')[1].trim().replace(/\.$/, '');
    }
    return 'achieve goals';
  }
}

export const userStoryAPIService = UserStoryAPIService.getInstance();

// ============================================================================
// MAIN USER STORY SERVICE
// ============================================================================

export class UserStoryService {
  private static instance: UserStoryService;
  private userStoryAPIService = userStoryAPIService;

  public static getInstance(): UserStoryService {
    if (!UserStoryService.instance) {
      UserStoryService.instance = new UserStoryService();
    }
    return UserStoryService.instance;
  }

  // NEW: Unified method that handles both online and offline modes
  async generateUserStories(projectId: string, token?: string | null, projectData?: LocalProject): Promise<any> {
    const isAuthenticated = !!token;
    
    if (isAuthenticated && token) {
      console.log('🟢 ONLINE MODE: Using authenticated API');
      return await this.generateUserStoriesOnline(projectId, token);
    } else {
      console.log('🟡 OFFLINE MODE: Using local project API');
      return await this.generateUserStoriesOfflineAPI(projectId, projectData);
    }
  }

  // Generate user stories via API (authenticated)
  async generateUserStoriesOnline(projectId: string, token: string): Promise<any> {
    try {
      console.log('🚀 Attempting to generate user stories for project:', projectId);

      const response = await fetch(`/api/projects/${projectId}/generate-user-stories/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 API Response data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Generation failed on server');
      }

      // FIXED: Handle both response formats
      let storiesToSave = [];
      
      if (data.stories && Array.isArray(data.stories)) {
        console.log(`📥 Received ${data.stories.length} stories from API (stories field)`);
        storiesToSave = data.stories;
      } else if (data.data && Array.isArray(data.data)) {
        console.log(`📥 Received ${data.data.length} stories from API (data field)`);
        storiesToSave = data.data;
      } else {
        throw new Error('No stories received from API in expected format');
      }

      // Save stories to localStorage
      if (storiesToSave.length > 0) {
        console.log('💾 Saving stories to localStorage...');
        this.saveStoriesToLocalStorage(storiesToSave, projectId);
      }

      return {
        success: true,
        message: data.message || `Generated ${storiesToSave.length} user stories`,
        data: storiesToSave,
        count: storiesToSave.length,
        source: 'database_generated'
      };

    } catch (error) {
      console.error('❌ Error generating user stories online:', error);
      throw error;
    }
  }

  // Generate user stories via API for local projects (no auth required)
  async generateUserStoriesOfflineAPI(projectId: string, projectData?: LocalProject): Promise<any> {
    try {
      console.log('🔄 Generating user stories for local project via API:', projectId);

      // Get project data from localStorage if not provided
      const project = projectData || localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found in localStorage');
      }

      // Prepare project data for the API
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

      console.log('📤 Sending project data to local API:', apiProjectData);

      // Call the new endpoint for local projects
      const response = await fetch('/api/local-projects/generate-user-stories/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          project_data: apiProjectData,
          project_id: projectId 
        })
      });

      console.log('📡 Local API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Local API Error:', errorText);
        throw new Error(`Local API error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 Local API Response data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Local generation failed on server');
      }

      // Save the generated stories to localStorage
      let storiesToSave = [];
      
      if (data.stories && Array.isArray(data.stories)) {
        console.log(`📥 Received ${data.stories.length} stories from local API`);
        storiesToSave = data.stories;
      } else if (data.data && Array.isArray(data.data)) {
        console.log(`📥 Received ${data.data.length} stories from local API (data field)`);
        storiesToSave = data.data;
      }

      if (storiesToSave.length > 0) {
        this.saveStoriesToLocalStorage(storiesToSave, projectId);
        console.log(`✅ Saved ${storiesToSave.length} stories to localStorage`);
      }

      return {
        success: true,
        message: data.message || `Generated ${storiesToSave.length} user stories`,
        stories: storiesToSave,
        count: storiesToSave.length
      };
    } catch (error) {
      console.error('❌ Error generating user stories via local API:', error);
      
      console.log('🔄 Falling back to template-based generation');
      return this.generateUserStoriesOfflineFallback(projectId);
    }
  }

  // Fallback to template generation when API fails
  private async generateUserStoriesOfflineFallback(projectId: string): Promise<any> {
    try {
      const project = localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found in localStorage');
      }

      const stories = this.generateUserStoriesOffline(project);
      
      return {
        success: true,
        message: `Generated ${stories.length} user stories using templates`,
        stories: stories.map(story => ({
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
          generated_by_llm: false,
          iteration: 1
        })),
        count: stories.length
      };
    } catch (error) {
      console.error('❌ Template generation also failed:', error);
      throw error;
    }
  }

  // FIXED: Save API stories to localStorage
  private saveStoriesToLocalStorage(apiStories: any[], projectId: string): void {
    try {
      console.log('💾 Saving API stories to localStorage');
      console.log('🔍 API Stories structure:', apiStories.length > 0 ? apiStories[0] : 'No stories');
      
      // Clear existing stories for this project
      localStorageService.clearProjectStories(projectId);
      console.log(`🧹 Cleared existing stories for project ${projectId}`);

      // Save new stories
      let savedCount = 0;
      let errorCount = 0;
      
      apiStories.forEach((apiStory: any, index: number) => {
        try {
          // Debug each story
          console.log(`📝 Processing story ${index}:`, apiStory);
          
          // Handle different API response formats
          const storyText = apiStory.story_text || apiStory.text || '';
          const storyId = apiStory.story_id || apiStory.id || `US_${Date.now()}_${index}`;
          
          const localStory: Omit<LocalUserStory, 'story_id' | 'created_at' | 'updated_at'> = {
            project_id: projectId,
            story_text: storyText,
            role: apiStory.role || 'User',
            action: apiStory.action || this.extractActionFromStory(storyText),
            benefit: apiStory.benefit || this.extractBenefitFromStory(storyText),
            feature: apiStory.feature || 'General',
            acceptance_criteria: apiStory.acceptance_criteria || [],
            priority: (apiStory.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
            story_points: apiStory.story_points || 0,
            status: (apiStory.status as 'draft' | 'reviewed' | 'approved' | 'implemented') || 'draft',
            generated_by_llm: apiStory.generated_by_llm !== undefined ? apiStory.generated_by_llm : true,
            iteration: apiStory.iteration || 1
          };

          // Create with custom ID
          const savedStory = localStorageService.createUserStory(localStory, storyId);
          if (savedStory) {
            savedCount++;
            console.log(`✅ Saved story: ${storyId}`);
          }
        } catch (err) {
          console.error(`❌ Error saving story ${index}:`, err);
          errorCount++;
        }
      });
      
      console.log(`🎉 Successfully saved ${savedCount}/${apiStories.length} stories to localStorage (${errorCount} errors)`);
      
      // Verify save
      const verifyStories = localStorageService.getUserStoriesByProject(projectId);
      console.log(`📊 Verification: Now have ${verifyStories.length} stories in localStorage for project ${projectId}`);
      
    } catch (error) {
      console.error('❌ Failed to save stories to localStorage:', error);
    }
  }

  // Generate user stories offline (template-based)
  generateUserStoriesOffline(project: LocalProject): LocalUserStory[] {
    console.log('📝 Generating user stories offline for project:', project.title);

    const domain = project.domain || 'general';

    const domainTemplates: Record<string, any> = {
      'finance': {
        roles: ['investor', 'financial advisor', 'portfolio manager', 'admin'],
        actions: ['view investment portfolio', 'analyze market trends', 'manage client accounts', 'generate financial reports']
      },
      'ecommerce': {
        roles: ['customer', 'seller', 'admin', 'shipper'],
        actions: ['browse products', 'make purchases', 'manage inventory', 'track orders']
      },
      'healthcare': {
        roles: ['patient', 'doctor', 'nurse', 'admin'],
        actions: ['schedule appointments', 'view medical records', 'prescribe medication', 'manage patient data']
      },
      'general': {
        roles: ['user', 'manager', 'admin', 'guest'],
        actions: ['login to system', 'manage profile', 'view dashboard', 'perform core actions']
      }
    };

    const template = domainTemplates[domain] || domainTemplates.general;
    const userStories: LocalUserStory[] = [];

    template.roles.forEach((role: string, roleIndex: number) => {
      const storyCount = 3 + (roleIndex % 3);

      for (let i = 0; i < storyCount; i++) {
        const action = template.actions[i % template.actions.length];
        const benefit = `achieve ${action.replace(/\s+/g, ' ')} efficiently`;

        let priority: 'low' | 'medium' | 'high' | 'critical';
        if (i === 0) priority = 'high';
        else if (i === 1) priority = 'medium';
        else priority = 'low';

        const userStory: Omit<LocalUserStory, 'story_id' | 'created_at' | 'updated_at'> = {
          project_id: project.project_id,
          story_text: `As a ${role}, I want to ${action} so that I can ${benefit}`,
          role: role,
          action: action,
          benefit: benefit,
          feature: this.capitalizeFirstLetter(action.split(' ')[0]),
          acceptance_criteria: [
            `System should allow ${role} to ${action}`,
            `Proper validation for ${action} operation`,
            `User feedback after ${action}`
          ],
          priority: priority,
          story_points: [1, 2, 3, 5, 8][i % 5],
          status: 'draft',
          generated_by_llm: false,
          iteration: 1
        };

        const createdStory = localStorageService.createUserStory(userStory);
        userStories.push(createdStory);
      }
    });

    console.log(`✅ Generated ${userStories.length} user stories offline`);
    return userStories;
  }

  // NEW: Unified sync method
  async syncUserStories(projectId: string, token?: string | null): Promise<{
    success: boolean;
    syncedFromDb: boolean;
    message: string;
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
      console.log('🔄 Starting user stories sync...');
      
      // 1. Try to sync FROM database TO localStorage
      const syncResult = await this.userStoryAPIService.syncDatabaseToLocalStorage(projectId, token);
      
      if (syncResult.success && syncResult.syncedCount > 0) {
        console.log(`✅ Synced ${syncResult.syncedCount} stories from database`);
        
        // Reload local data after sync
        const updatedStories = localStorageService.getUserStoriesByProject(projectId);
        console.log(`📊 Now have ${updatedStories.length} stories in localStorage`);
        
        return {
          success: true,
          syncedFromDb: true,
          message: syncResult.message
        };
      } else if (syncResult.success && syncResult.syncedCount === 0) {
        console.log('ℹ️ No stories in database, using local data');
        
        // 2. If database empty, sync TO database FROM localStorage
        const localStories = localStorageService.getUserStoriesByProject(projectId);
        if (localStories.length > 0) {
          console.log(`📤 Syncing ${localStories.length} local stories to database...`);
          const uploadResult = await this.userStoryAPIService.syncLocalToDatabase(projectId, token);
          
          return {
            success: uploadResult.success,
            syncedFromDb: false,
            message: uploadResult.message
          };
        }
        
        return {
          success: true,
          syncedFromDb: false,
          message: 'No stories in database or localStorage'
        };
      } else {
        console.warn('Database sync failed:', syncResult.message);
        return {
          success: false,
          syncedFromDb: false,
          message: syncResult.message
        };
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
      return {
        success: false,
        syncedFromDb: false,
        message: `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Enhanced unified generation method
  async generateUserStoriesWithSync(projectId: string, token?: string | null, projectData?: LocalProject): Promise<any> {
    try {
      const isAuthenticated = !!token;
      
      // If authenticated, sync first
      if (isAuthenticated && token) {
        console.log('🔄 Authenticated: Starting sync before generation...');
        const syncResult = await this.syncUserStories(projectId, token);
        
        if (syncResult.syncedFromDb) {
          // If we got data from database, return it
          console.log('✅ Using synced data from database');
          const stories = localStorageService.getUserStoriesByProject(projectId);
          return {
            success: true,
            message: `Loaded ${stories.length} stories from database`,
            data: stories,
            count: stories.length,
            source: 'database'
          };
        }
      }
      
      // Check if we already have stories locally
      const existingStories = localStorageService.getUserStoriesByProject(projectId);
      if (existingStories.length > 0) {
        console.log(`ℹ️ Found ${existingStories.length} existing local stories`);
        return {
          success: true,
          message: `Loaded ${existingStories.length} existing stories`,
          data: existingStories,
          count: existingStories.length,
          source: 'local_cache'
        };
      }
      
      // If no stories exist, generate new ones
      console.log('🔄 No stories found, generating new...');
      
      if (isAuthenticated && token) {
        // Generate via API
        return await this.generateUserStoriesOnline(projectId, token);
      } else {
        // Generate locally
        return await this.generateUserStoriesOfflineAPI(projectId, projectData);
      }
      
    } catch (error) {
      console.error('❌ Generation failed:', error);
      throw error;
    }
  }

  // NEW: Sync project and generate stories
  async syncProjectAndGenerateStories(projectId: string, token: string): Promise<any> {
    try {
      console.log('🔄 Starting project sync and generation...');
      
      // 1. First, sync project from database to localStorage
      const projectSyncResult = await this.userStoryAPIService.syncProjectFromDatabase(projectId, token);
      
      if (!projectSyncResult.success) {
        throw new Error(`Failed to sync project: ${projectSyncResult.message}`);
      }
      
      console.log('✅ Project synced from database');
      
      // 2. Get the synced project from localStorage
      const project = localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found in localStorage after sync');
      }
      
      // 3. Generate user stories using the synced project data
      return await this.generateUserStoriesWithSync(projectId, token, project);
      
    } catch (error) {
      console.error('❌ Project sync and generation failed:', error);
      throw error;
    }
  }

  // Helper methods
  private extractActionFromStory(storyText: string): string {
    try {
      if (storyText.includes('I want to')) {
        const actionPart = storyText.split('I want to')[1];
        if (actionPart.includes('so that')) {
          return actionPart.split('so that')[0].trim();
        }
        return actionPart.trim();
      }
      return 'use the system';
    } catch {
      return 'use the system';
    }
  }

  private extractBenefitFromStory(storyText: string): string {
    try {
      if (storyText.includes('so that')) {
        return storyText.split('so that')[1].trim().replace(/\.$/, '');
      }
      return 'achieve their goals';
    } catch {
      return 'achieve their goals';
    }
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

export const userStoryService = UserStoryService.getInstance();