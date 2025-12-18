// frontend/app/services/ScenarioSyncService.ts
import { localStorageService } from "../utils/localStorageService";
import type { LocalScenario } from "../utils/localStorageModels";

class ScenarioSyncService {
  private static instance: ScenarioSyncService;

  public static getInstance(): ScenarioSyncService {
    if (!ScenarioSyncService.instance) {
      ScenarioSyncService.instance = new ScenarioSyncService();
    }
    return ScenarioSyncService.instance;
  }

  // Get scenarios from database API - FIXED: Use correct endpoint
  async fetchScenariosFromDatabase(projectId: string, token: string): Promise<any> {
    try {
      console.log(`📡 Fetching scenarios from database for project: ${projectId}`);
      
      // Use scenarios-sync endpoint instead of scenarios/
      const response = await fetch(`/api/projects/${projectId}/scenarios-sync/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Scenario Database API Response status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('No scenarios found in database');
          return { success: true, data: [], count: 0 };
        }
        
        const errorText = await response.text();
        console.error('Scenario Database API Error:', errorText);
        
        // Try alternative endpoint
        return await this.fetchScenariosAlternative(projectId, token);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Error fetching scenarios from database:', error);
      throw error;
    }
  }

  // Alternative fetch method using projects/scenarios/ endpoint
  private async fetchScenariosAlternative(projectId: string, token: string): Promise<any> {
    try {
      const response = await fetch(`/api/projects/${projectId}/scenarios/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Alternative fetch failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform to match expected format
      return {
        success: true,
        data: data.scenarios || [],
        count: data.count || (data.scenarios ? data.scenarios.length : 0)
      };
    } catch (error) {
      console.error('Alternative fetch failed:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: 'Failed to fetch scenarios'
      };
    }
  }

  // Sync database scenarios to localStorage - FIXED
  async syncDatabaseToLocalStorage(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
    databaseCount: number;
  }> {
    try {
      // 1. Fetch from database
      const dbResult = await this.fetchScenariosFromDatabase(projectId, token);
      
      if (!dbResult.success || !dbResult.data) {
        return {
          success: false,
          syncedCount: 0,
          message: dbResult.error || 'Failed to fetch from database',
          databaseCount: 0
        };
      }

      const dbScenarios = dbResult.data || dbResult.scenarios || [];
      const databaseCount = dbScenarios.length;
      console.log(`🔍 Found ${databaseCount} scenarios in database`);
      
      if (databaseCount === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: 'No scenarios in database to sync',
          databaseCount: 0
        };
      }

      // 2. Clear existing local scenarios for this project
      this.clearProjectScenarios(projectId);
      console.log(`🧹 Cleared existing local scenarios for project ${projectId}`);

      // 3. Convert database scenarios to localStorage format and save
      let savedCount = 0;
      dbScenarios.forEach((dbScenario: any) => {
        try {
          const scenarioData: Omit<LocalScenario, 'scenario_id' | 'created_at' | 'updated_at'> = {
            project_id: projectId,
            user_story_id: dbScenario.user_story_id || null,
            scenario_text: dbScenario.scenario_text || '',
            scenario_type: dbScenario.scenario_type || 'happy_path',
            title: dbScenario.title || 'Scenario',
            detected_domain: dbScenario.detected_domain || 'general',
            has_proper_structure: dbScenario.has_proper_structure || true,
            gherkin_steps: dbScenario.gherkin_steps || [],
            enhanced_with_llm: dbScenario.enhanced_with_llm || false,
            status: dbScenario.status || 'draft',
          };

          // Use the scenario_id from database or generate new one
          const scenarioId = dbScenario.scenario_id || dbScenario.id;
          const savedScenario = localStorageService.createScenario(scenarioData, scenarioId);
          if (savedScenario) savedCount++;
        } catch (err) {
          console.error(`Error converting scenario:`, err);
        }
      });

      console.log(`✅ Successfully synced ${savedCount} scenarios to localStorage`);
      
      return {
        success: true,
        syncedCount: savedCount,
        message: `Synced ${savedCount} scenarios from database to localStorage`,
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

  // Sync local scenarios to database - FIXED: Use bulk sync only
  async syncLocalToDatabase(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      const localScenarios = localStorageService.getScenariosByProject(projectId);
      
      if (localScenarios.length === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: 'No local scenarios to sync'
        };
      }

      console.log(`📤 Syncing ${localScenarios.length} local scenarios to database using bulk sync...`);

      // Prepare data for bulk sync
      const localScenariosData = localScenarios.map(sc => ({
        scenario_id: sc.scenario_id,
        project_id: projectId,
        user_story_id: sc.user_story_id,
        scenario_text: sc.scenario_text || '',
        scenario_type: sc.scenario_type || 'happy_path',
        title: sc.title || 'Scenario',
        detected_domain: sc.detected_domain || 'general',
        has_proper_structure: sc.has_proper_structure || true,
        gherkin_steps: sc.gherkin_steps || [],
        enhanced_with_llm: sc.enhanced_with_llm || false,
        status: sc.status || 'draft',
        updated_at: new Date().toISOString()
      }));

      // Use the bulk sync endpoint (this should work)
      const response = await fetch(`/api/projects/${projectId}/sync-scenarios/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          local_scenarios: localScenariosData
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bulk sync failed:', errorText);
        return {
          success: false,
          syncedCount: 0,
          message: `Bulk sync failed: ${response.status} - ${errorText}`
        };
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Bulk sync successful: ${data.message}`);
        return {
          success: true,
          syncedCount: data.stats?.total || localScenarios.length,
          message: data.message || `Bulk synced ${localScenarios.length} scenarios`
        };
      } else {
        return {
          success: false,
          syncedCount: 0,
          message: data.error || 'Bulk sync failed'
        };
      }

    } catch (error) {
      console.error('Error syncing local to database:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Network error'}`
      };
    }
  }

  // Individual scenario sync (fallback) - FIXED: Handle 404 properly
  async syncIndividualScenario(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
  }> {
    try {
      const localScenarios = localStorageService.getScenariosByProject(projectId);
      
      if (localScenarios.length === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: 'No local scenarios to sync'
        };
      }

      console.log(`🔄 Syncing ${localScenarios.length} scenarios individually...`);
      
      let syncedCount = 0;
      let errors: string[] = [];

      for (const scenario of localScenarios) {
        try {
          const scenarioData = {
            scenario_id: scenario.scenario_id,
            project_id: projectId,
            user_story_id: scenario.user_story_id,
            scenario_text: scenario.scenario_text || '',
            scenario_type: scenario.scenario_type || 'happy_path',
            title: scenario.title || 'Scenario',
            detected_domain: scenario.detected_domain || 'general',
            has_proper_structure: scenario.has_proper_structure || true,
            gherkin_steps: scenario.gherkin_steps || [],
            enhanced_with_llm: scenario.enhanced_with_llm || false,
            status: scenario.status || 'draft',
            updated_at: new Date().toISOString()
          };

          // FIXED: Always use create endpoint for individual sync
          // Since update endpoint (PUT /api/scenarios/{id}/) has issues with 404
          const createResponse = await fetch('/api/scenarios/create/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(scenarioData)
          });

          if (createResponse.ok) {
            syncedCount++;
            console.log(`✅ Created scenario ${scenario.scenario_id}`);
          } else if (createResponse.status === 400) {
            // Might be duplicate, try update
            const updateResponse = await fetch(`/api/scenarios/${scenario.scenario_id}/`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(scenarioData)
            });
            
            if (updateResponse.ok) {
              syncedCount++;
              console.log(`✅ Updated scenario ${scenario.scenario_id}`);
            } else {
              errors.push(`Failed to update scenario ${scenario.scenario_id}: ${updateResponse.status}`);
            }
          } else {
            errors.push(`Failed to create scenario ${scenario.scenario_id}: ${createResponse.status}`);
          }
        } catch (err) {
          console.error(`Error syncing scenario ${scenario.scenario_id}:`, err);
          errors.push(`Error: ${scenario.scenario_id}`);
        }
      }

      const message = errors.length === 0
        ? `Successfully synced ${syncedCount} scenarios individually`
        : `Synced ${syncedCount} scenarios with ${errors.length} errors`;

      return {
        success: errors.length === 0,
        syncedCount,
        message
      };

    } catch (error) {
      console.error('Individual sync error:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Individual sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Check if scenarios exist in database
  async checkScenariosExist(projectId: string, token: string): Promise<{
    success: boolean;
    exists: boolean;
    scenarioCount: number;
    message: string;
  }> {
    try {
      const response = await fetch(`/api/projects/${projectId}/check-scenarios/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // If check endpoint fails, try fetching scenarios directly
        const fetchResult = await this.fetchScenariosFromDatabase(projectId, token);
        return {
          success: fetchResult.success,
          exists: fetchResult.success && (fetchResult.data?.length > 0 || fetchResult.scenarios?.length > 0),
          scenarioCount: fetchResult.data?.length || fetchResult.scenarios?.length || 0,
          message: fetchResult.success ? 'Checked via fetch' : 'Check failed'
        };
      }

      const data = await response.json();
      return {
        success: data.success,
        exists: data.exists || false,
        scenarioCount: data.scenario_count || data.scenarioCount || 0,
        message: data.message || 'Checked scenarios existence'
      };

    } catch (error) {
      console.error('Error checking scenarios existence:', error);
      return {
        success: false,
        exists: false,
        scenarioCount: 0,
        message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Clear scenarios for a project
  private clearProjectScenarios(projectId: string): void {
    try {
      const allScenarios = localStorageService.getAllScenarios();
      const filteredScenarios = allScenarios.filter(s => s.project_id !== projectId);
      
      // Save back to localStorage
      localStorage.setItem('local_scenarios', JSON.stringify(filteredScenarios));
      console.log(`🧹 Cleared scenarios for project ${projectId}`);
    } catch (error) {
      console.error('Error clearing project scenarios:', error);
    }
  }

  // Two-way sync scenarios - FIXED: Use bulk sync endpoint
  async twoWaySyncScenarios(projectId: string, token: string): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
    mergedScenarios?: any[];
  }> {
    try {
      const localScenarios = localStorageService.getScenariosByProject(projectId);
      
      if (localScenarios.length === 0) {
        // If no local scenarios, just sync from database
        return await this.syncDatabaseToLocalStorage(projectId, token);
      }

      console.log('🔄 Starting two-way scenario sync...');
      
      // Prepare local scenarios for sync
      const localScenariosData = localScenarios.map(sc => ({
        scenario_id: sc.scenario_id,
        project_id: projectId,
        user_story_id: sc.user_story_id,
        scenario_text: sc.scenario_text,
        scenario_type: sc.scenario_type,
        title: sc.title,
        detected_domain: sc.detected_domain,
        has_proper_structure: sc.has_proper_structure,
        gherkin_steps: sc.gherkin_steps,
        enhanced_with_llm: sc.enhanced_with_llm,
        status: sc.status,
        updated_at: sc.updated_at || sc.created_at || new Date().toISOString()
      }));
      
      const response = await fetch(`/api/projects/${projectId}/sync-scenarios/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          local_scenarios: localScenariosData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Clear and save merged scenarios
        this.clearProjectScenarios(projectId);
        let savedCount = 0;
        const mergedScenarios: LocalScenario[] = [];
        
        data.data.forEach((scenario: any) => {
          try {
            const localScenario: Omit<LocalScenario, 'scenario_id' | 'created_at' | 'updated_at'> = {
              project_id: projectId,
              user_story_id: scenario.user_story_id || null,
              scenario_text: scenario.scenario_text || '',
              scenario_type: scenario.scenario_type || 'happy_path',
              title: scenario.title || 'Scenario',
              detected_domain: scenario.detected_domain || 'general',
              has_proper_structure: scenario.has_proper_structure || true,
              gherkin_steps: scenario.gherkin_steps || [],
              enhanced_with_llm: scenario.enhanced_with_llm || false,
              status: scenario.status || 'draft',
            };

            const savedScenario = localStorageService.createScenario(
              localScenario, 
              scenario.scenario_id || scenario.id
            );
            if (savedScenario) {
              savedCount++;
              mergedScenarios.push(savedScenario);
            }
          } catch (err) {
            console.error(`Error saving merged scenario:`, err);
          }
        });

        return {
          success: true,
          syncedCount: savedCount,
          message: data.message || `Two-way synced ${savedCount} scenarios`,
          mergedScenarios
        };
      }

      // If bulk sync fails, fall back to simpler sync
      console.log('🔄 Bulk sync failed, falling back to simpler sync...');
      const syncResult = await this.syncLocalToDatabase(projectId, token);
      if (syncResult.success) {
        return {
          success: true,
          syncedCount: syncResult.syncedCount,
          message: syncResult.message + ' (fallback sync)'
        };
      }

      return {
        success: false,
        syncedCount: 0,
        message: data.error || 'Two-way sync failed'
      };

    } catch (error) {
      console.error('Error in two-way sync:', error);
      return {
        success: false,
        syncedCount: 0,
        message: `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get scenario sync status
  async getScenarioSyncStatus(projectId: string, token: string): Promise<{
    success: boolean;
    sync_status?: any;
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
      console.error('Error getting scenario sync status:', error);
      return {
        success: false,
        message: `Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Delete scenario from database
  async deleteScenarioFromDatabase(scenarioId: string, token: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await fetch(`/api/scenarios/${scenarioId}/delete/`, {
        method: 'DELETE',
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
        message: data.message || 'Scenario deleted'
      };

    } catch (error) {
      console.error('Error deleting scenario:', error);
      return {
        success: false,
        message: `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const scenarioSyncService = ScenarioSyncService.getInstance();