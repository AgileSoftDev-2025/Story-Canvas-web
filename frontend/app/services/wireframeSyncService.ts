// frontend/app/services/wireframeSyncService.ts
import { localStorageService } from "../utils/localStorageService";
import type { LocalProject, LocalWireframe } from "../utils/localStorageModels";

class WireframeAPIService {
  private static instance: WireframeAPIService;

  public static getInstance(): WireframeAPIService {
    if (!WireframeAPIService.instance) {
      WireframeAPIService.instance = new WireframeAPIService();
    }
    return WireframeAPIService.instance;
  }

  // Get wireframes from database API
  async fetchWireframesFromDatabase(projectId: string, token: string): Promise<any> {
    try {
      console.log(`📡 Fetching wireframes from database for project: ${projectId}`);
      
      const response = await fetch(`/api/projects/${projectId}/wireframes-sync/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Wireframe Database API Response status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('No wireframes found in database');
          return { success: true, data: [], count: 0 };
        }
        
        const errorText = await response.text();
        console.error('Wireframe Database API Error:', errorText);
        throw new Error(`Database error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Error fetching wireframes from database:', error);
      throw error;
    }
  }

  // Sync database wireframes to localStorage WITHOUT timestamp saving
  async syncDatabaseToLocalStorage(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
    databaseCount: number;
  }> {
    try {
      // 1. Fetch from database
      const dbResult = await this.fetchWireframesFromDatabase(projectId, token);
      
      if (!dbResult.success || !dbResult.data) {
        return {
          success: false,
          syncedCount: 0,
          message: dbResult.error || 'Failed to fetch from database',
          databaseCount: 0
        };
      }

      const dbWireframes = dbResult.data;
      const databaseCount = dbWireframes.length;
      console.log(`🔍 Found ${databaseCount} wireframes in database`);
      
      if (databaseCount === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: 'No wireframes in database to sync',
          databaseCount: 0
        };
      }

      // 2. Clear existing local wireframes for this project
      this.clearProjectWireframes(projectId);
      console.log(`🧹 Cleared existing local wireframes for project ${projectId}`);

      // 3. Convert database wireframes to localStorage format and save
      let savedCount = 0;
      dbWireframes.forEach((dbWireframe: any) => {
        try {
          const localWireframe: Omit<LocalWireframe, 'wireframe_id' | 'created_at' | 'updated_at'> = {
            project_id: projectId,
            page_name: dbWireframe.page_name || '',
            page_type: dbWireframe.page_type || 'general',
            description: dbWireframe.description || '',
            html_content: dbWireframe.html_content || '',
            creole_content: dbWireframe.creole_content || '',
            salt_diagram: dbWireframe.salt_diagram || '',
            generated_with_rag: dbWireframe.generated_with_rag || false,
            wireframe_type: dbWireframe.wireframe_type || 'desktop',
            version: dbWireframe.version || 1,
            preview_url: dbWireframe.preview_url || '',
            stories_count: dbWireframe.stories_count || 0,
            features_count: dbWireframe.features_count || 0,
            generated_at: dbWireframe.generated_at || new Date().toISOString(),
            is_local: false  // Mark as from database
          };

          const savedWireframe = localStorageService.createWireframe(localWireframe, dbWireframe.wireframe_id);
          if (savedWireframe) savedCount++;
        } catch (err) {
          console.error(`Error converting wireframe ${dbWireframe.wireframe_id}:`, err);
        }
      });

      console.log(`✅ Successfully synced ${savedCount} wireframes to localStorage`);
      
      return {
        success: true,
        syncedCount: savedCount,
        message: `Synced ${savedCount} wireframes from database to localStorage`,
        databaseCount
      };

    } catch (error) {
      console.error('Error syncing database to localStorage:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        databaseCount: 0
      };
    }
  }

  // Sync local wireframes to database WITHOUT timestamp saving
  async syncLocalToDatabase(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      const localWireframes = localStorageService.getWireframesByProject(projectId);
      
      if (localWireframes.length === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: 'No local wireframes to sync'
        };
      }

      console.log(`📤 Syncing ${localWireframes.length} local wireframes to database...`);

      let syncedCount = 0;
      let errors: string[] = [];

      // Use bulk sync endpoint for efficiency
      const wireframesData = localWireframes.map(wf => ({
        wireframe_id: wf.wireframe_id,
        project_id: projectId,
        page_name: wf.page_name,
        page_type: wf.page_type,
        description: wf.description || '',
        html_content: wf.html_content || '',
        creole_content: wf.creole_content || '',
        salt_diagram: wf.salt_diagram || '',
        generated_with_rag: wf.generated_with_rag || false,
        wireframe_type: wf.wireframe_type || 'desktop',
        version: wf.version || 1,
        preview_url: wf.preview_url || '',
        stories_count: wf.stories_count || 0,
        features_count: wf.features_count || 0,
        generated_at: wf.generated_at || new Date().toISOString(),
        is_local: wf.is_local || true,
        updated_at: new Date().toISOString()
      }));

      const response = await fetch('/api/wireframes/bulk-sync/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: projectId,
          operation: 'push',
          wireframes: wireframesData
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          syncedCount = result.stats?.total || wireframesData.length;
          console.log(`✅ Successfully synced ${syncedCount} wireframes to database`);
        } else {
          errors.push(result.error || 'Bulk sync failed');
        }
      } else {
        const errorText = await response.text();
        errors.push(`Bulk sync failed: ${errorText}`);
      }

      if (errors.length > 0) {
        console.warn(`Sync completed with ${errors.length} errors:`, errors);
      }

      return {
        success: errors.length === 0,
        syncedCount,
        message: errors.length === 0 
          ? `Successfully synced ${syncedCount} wireframes to database`
          : `Synced ${syncedCount} wireframes with ${errors.length} errors`
      };

    } catch (error) {
      console.error('Error syncing local to database:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Network error'}`
      };
    }
  }

  // Check if wireframes exist in database
  async checkWireframesExist(projectId: string, token: string): Promise<{
    success: boolean;
    exists: boolean;
    wireframe_count: number;
    message: string;
  }> {
    try {
      const response = await fetch(`/api/projects/${projectId}/check-wireframes/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return {
          success: false,
          exists: false,
          wireframe_count: 0,
          message: `HTTP error! status: ${response.status}`
        };
      }

      const data = await response.json();
      return {
        success: data.success,
        exists: data.exists || false,
        wireframe_count: data.wireframe_count || 0,
        message: data.message || 'Checked wireframes existence'
      };

    } catch (error) {
      console.error('Error checking wireframes existence:', error);
      return {
        success: false,
        exists: false,
        wireframe_count: 0,
        message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get wireframe sync status WITHOUT localStorage timestamps
  async getWireframeSyncStatus(projectId: string, token: string): Promise<{
    success: boolean;
    sync_status: any;
    message: string;
  }> {
    try {
      const localWireframes = localStorageService.getWireframesByProject(projectId);
      const localCount = localWireframes.length;
      const localLastUpdate = localWireframes.length > 0 
        ? new Date(Math.max(...localWireframes.map(w => new Date(w.updated_at || w.created_at).getTime()))).toISOString()
        : null;

      const queryParams = new URLSearchParams({
        local_count: localCount.toString(),
        ...(localLastUpdate && { local_last_update: localLastUpdate })
      });

      const response = await fetch(`/api/projects/${projectId}/wireframe-sync-status/?${queryParams}`, {
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
      console.error('Error getting wireframe sync status:', error);
      return {
        success: false,
        sync_status: null,
        message: `Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Clear wireframes for a project
  private clearProjectWireframes(projectId: string): void {
    try {
      const allWireframes = localStorageService.getAllWireframes();
      const filteredWireframes = allWireframes.filter(wf => wf.project_id !== projectId);
      
      // Save back to localStorage
      localStorage.setItem('local_wireframes', JSON.stringify(filteredWireframes));
      console.log(`🧹 Cleared wireframes for project ${projectId}`);
    } catch (error) {
      console.error('Error clearing project wireframes:', error);
    }
  }

  // Two-way sync wireframes WITHOUT timestamp saving
  async twoWaySyncWireframes(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
    mergedWireframes: any[];
  }> {
    try {
      const localWireframes = localStorageService.getWireframesByProject(projectId);
      
      const response = await fetch(`/api/projects/${projectId}/sync-wireframes/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          local_wireframes: localWireframes.map(wf => ({
            wireframe_id: wf.wireframe_id,
            page_name: wf.page_name,
            page_type: wf.page_type,
            description: wf.description,
            html_content: wf.html_content,
            creole_content: wf.creole_content,
            salt_diagram: wf.salt_diagram,
            generated_with_rag: wf.generated_with_rag,
            wireframe_type: wf.wireframe_type,
            version: wf.version,
            preview_url: wf.preview_url,
            stories_count: wf.stories_count,
            features_count: wf.features_count,
            generated_at: wf.generated_at,
            is_local: wf.is_local,
            updated_at: wf.updated_at || wf.created_at
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Clear and save merged wireframes
        this.clearProjectWireframes(projectId);
        let savedCount = 0;
        
        data.data.forEach((wireframe: any) => {
          try {
            const localWireframe: Omit<LocalWireframe, 'wireframe_id' | 'created_at' | 'updated_at'> = {
              project_id: projectId,
              page_name: wireframe.page_name,
              page_type: wireframe.page_type,
              description: wireframe.description || '',
              html_content: wireframe.html_content || '',
              creole_content: wireframe.creole_content || '',
              salt_diagram: wireframe.salt_diagram || '',
              generated_with_rag: wireframe.generated_with_rag || false,
              wireframe_type: wireframe.wireframe_type || 'desktop',
              version: wireframe.version || 1,
              preview_url: wireframe.preview_url || '',
              stories_count: wireframe.stories_count || 0,
              features_count: wireframe.features_count || 0,
              generated_at: wireframe.generated_at || new Date().toISOString(),
              is_local: false
            };

            const savedWireframe = localStorageService.createWireframe(localWireframe, wireframe.wireframe_id);
            if (savedWireframe) savedCount++;
          } catch (err) {
            console.error(`Error saving merged wireframe:`, err);
          }
        });

        return {
          success: true,
          syncedCount: savedCount,
          message: data.message || `Synced ${savedCount} wireframes`,
          mergedWireframes: data.data
        };
      }

      return {
        success: false,
        syncedCount: 0,
        message: data.error || 'Sync failed',
        mergedWireframes: []
      };

    } catch (error) {
      console.error('Error in two-way sync:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        mergedWireframes: []
      };
    }
  }
}

export const wireframeAPIService = WireframeAPIService.getInstance();