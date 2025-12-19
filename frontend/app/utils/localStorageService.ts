// frontend/app/utils/localStorageService.ts
import type {
  LocalUser,
  LocalProject,
  LocalUserStory,
  LocalWireframe,
  LocalScenario,
  LocalSession
} from './localStorageModels';

const generateShortUUID = (): string => {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

export class LocalStorageService {
  private static instance: LocalStorageService;
  
  private readonly KEYS = {
    CURRENT_USER: 'current_user',
    PROJECTS: 'local_projects',
    USER_STORIES: 'local_user_stories',
    WIREFRAMES: 'local_wireframes',  // ONLY USE THIS KEY FOR WIREFRAMES
    SCENARIOS: 'local_scenarios',
    SCENARIOS_BY_PROJECT: (projectId: string) => `scenarios_${projectId}`,
    SESSIONS_BY_PROJECT: (projectId: string) => `sessions_${projectId}`,
  };

  private constructor() {
    console.log('🔄 LocalStorageService initialized (unified wireframe storage)');
    this.cleanupDuplicateStorage(); // Clean up duplicates on initialization
  }

  public static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  // ===== USER METHODS =====
  
  setCurrentUser(userData: { username: string; email: string; is_active: boolean; last_login: string }): void {
    try {
      const user: LocalUser = {
        id: generateShortUUID(),
        username: userData.username,
        email: userData.email,
        is_active: userData.is_active,
        last_login: userData.last_login,
        created_at: getCurrentTimestamp(),
        updated_at: getCurrentTimestamp(),
      };
      
      localStorage.setItem(this.KEYS.CURRENT_USER, JSON.stringify(user));
      console.log('👤 User data saved:', user.username);
    } catch (error) {
      console.error('❌ Error saving user data:', error);
      throw error;
    }
  }

  clearCurrentUser(): void {
    try {
      localStorage.removeItem(this.KEYS.CURRENT_USER);
      console.log('👤 User data cleared');
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
    }
  }

  initializeDefaultUser(): LocalUser {
    const user: LocalUser = {
      id: 'guest_' + generateShortUUID(),
      username: 'guest',
      email: 'guest@example.com',
      is_active: true,
      last_login: getCurrentTimestamp(),
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    localStorage.setItem(this.KEYS.CURRENT_USER, JSON.stringify(user));
    console.log('👤 Created default guest user:', user.username);
    return user;
  }
  
  getOrCreateUser(): LocalUser {
    try {
      const userStr = localStorage.getItem(this.KEYS.CURRENT_USER);
      
      if (!userStr) {
        return this.initializeDefaultUser();
      }
      
      const user = JSON.parse(userStr) as LocalUser;
      console.log('👤 Retrieved existing user:', user.username);
      return user;
    } catch (error) {
      console.error('Error getting/creating user:', error);
      return this.initializeDefaultUser();
    }
  }
  
  getCurrentUser(): LocalUser | null {
    try {
      const userStr = localStorage.getItem(this.KEYS.CURRENT_USER);
      
      if (!userStr) {
        return null;
      }
      
      const user = JSON.parse(userStr) as LocalUser;
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // ===== PROJECT METHODS =====
  createProject(projectData: Omit<LocalProject, 'project_id' | 'created_at' | 'updated_at'>): LocalProject {
    console.log('📝 Creating project with data:', projectData);
    
    try {
      const projects = this.getAllProjects();
      const project: LocalProject = {
        ...projectData,
        project_id: generateShortUUID(),
        created_at: getCurrentTimestamp(),
        updated_at: getCurrentTimestamp(),
      };
      
      projects.push(project);
      localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
      
      console.log('✅ Project saved:', project.project_id);
      return project;
    } catch (error) {
      console.error('❌ Error creating project:', error);
      throw error;
    }
  }

  createProjectWithId(projectData: Omit<LocalProject, 'created_at' | 'updated_at'>): LocalProject {
    try {
      const project: LocalProject = {
        ...projectData,
        created_at: getCurrentTimestamp(),
        updated_at: getCurrentTimestamp()
      };

      const projects = this.getAllProjects();
      projects.push(project);
      localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
      
      console.log(`✅ Created project with ID: ${project.project_id}`);
      return project;
    } catch (error) {
      console.error('Error creating project with ID:', error);
      throw error;
    }
  }

  getProject(projectId: string): LocalProject | null {
    try {
      const projects = this.getAllProjects();
      const project = projects.find(p => p.project_id === projectId) || null;
      
      console.log(`🔍 Getting project ${projectId}:`, project ? 'Found' : 'Not found');
      return project;
    } catch (error) {
      console.error('❌ Error getting project:', error);
      return null;
    }
  }

  getAllProjects(): LocalProject[] {
    try {
      const projectsStr = localStorage.getItem(this.KEYS.PROJECTS);
      const projects = projectsStr ? JSON.parse(projectsStr) : [];
      console.log(`📚 Retrieved ${projects.length} projects from localStorage`);
      return projects;
    } catch (error) {
      console.error('❌ Error getting all projects:', error);
      return [];
    }
  }

  updateProject(projectId: string, updates: Partial<LocalProject>): LocalProject | null {
    try {
      const projects = this.getAllProjects();
      const projectIndex = projects.findIndex(p => p.project_id === projectId);
      
      if (projectIndex === -1) {
        console.log('❌ Project not found for update:', projectId);
        return null;
      }
      
      const updatedProject: LocalProject = {
        ...projects[projectIndex],
        ...updates,
        updated_at: getCurrentTimestamp(),
      };
      
      projects[projectIndex] = updatedProject;
      localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
      
      console.log('✅ Project updated:', projectId);
      return updatedProject;
    } catch (error) {
      console.error('❌ Error updating project:', error);
      return null;
    }
  }

  deleteProject(projectId: string): boolean {
    try {
      const projects = this.getAllProjects();
      const projectIndex = projects.findIndex(p => p.project_id === projectId);
      
      if (projectIndex === -1) {
        console.log('❌ Project not found for deletion:', projectId);
        return false;
      }
      
      // Delete related data
      this.clearProjectStories(projectId);
      this.clearProjectWireframes(projectId);
      this.clearProjectScenarios(projectId);
      
      projects.splice(projectIndex, 1);
      localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
      
      console.log('✅ Project deleted:', projectId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting project:', error);
      return false;
    }
  }

  // ===== USER STORY METHODS =====
  
  getStories(): LocalUserStory[] {
    try {
      const storiesStr = localStorage.getItem(this.KEYS.USER_STORIES);
      return storiesStr ? JSON.parse(storiesStr) : [];
    } catch (error) {
      console.error('Error getting stories:', error);
      return [];
    }
  }

  createUserStory(storyData: Omit<LocalUserStory, 'story_id' | 'created_at' | 'updated_at'>, customId?: string): LocalUserStory {
    try {
      const storyId = customId || this.generateStoryId();
      
      const newStory: LocalUserStory = {
        ...storyData,
        story_id: storyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const stories = this.getStories();
      stories.push(newStory);
      localStorage.setItem(this.KEYS.USER_STORIES, JSON.stringify(stories));
      
      console.log(`📝 Created story ${storyId} for project ${storyData.project_id}`);
      return newStory;
    } catch (error) {
      console.error('Error creating user story:', error);
      throw error;
    }
  }

  private generateStoryId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `US_${timestamp}_${random}`;
  }

  getUserStoriesByProject(projectId: string): LocalUserStory[] {
    const stories = this.getAllUserStories();
    const filteredStories = stories.filter(s => s.project_id === projectId);
    console.log(`📖 Found ${filteredStories.length} user stories for project ${projectId}`);
    return filteredStories;
  }

  getAllUserStories(): LocalUserStory[] {
    try {
      const storiesStr = localStorage.getItem(this.KEYS.USER_STORIES);
      const stories = storiesStr ? JSON.parse(storiesStr) : [];
      console.log(`📋 Total user stories in localStorage: ${stories.length}`);
      return stories;
    } catch (error) {
      console.error('❌ Error getting user stories:', error);
      return [];
    }
  }

  updateUserStory(storyId: string, updates: Partial<LocalUserStory>): LocalUserStory | null {
    try {
      const stories = this.getAllUserStories();
      const storyIndex = stories.findIndex(s => s.story_id === storyId);
      
      if (storyIndex === -1) {
        console.log('❌ User story not found for update:', storyId);
        return null;
      }
      
      const updatedStory: LocalUserStory = {
        ...stories[storyIndex],
        ...updates,
        updated_at: getCurrentTimestamp(),
      };
      
      stories[storyIndex] = updatedStory;
      localStorage.setItem(this.KEYS.USER_STORIES, JSON.stringify(stories));
      
      console.log('✅ User story updated:', storyId);
      return updatedStory;
    } catch (error) {
      console.error('❌ Error updating user story:', error);
      return null;
    }
  }

  deleteUserStory(storyId: string): boolean {
    try {
      const stories = this.getAllUserStories();
      const storyIndex = stories.findIndex(s => s.story_id === storyId);
      
      if (storyIndex === -1) {
        console.log('❌ User story not found for deletion:', storyId);
        return false;
      }
      
      stories.splice(storyIndex, 1);
      localStorage.setItem(this.KEYS.USER_STORIES, JSON.stringify(stories));
      
      console.log('✅ User story deleted:', storyId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting user story:', error);
      return false;
    }
  }

  clearProjectStories(projectId: string): void {
    try {
      const stories = this.getAllUserStories();
      const filteredStories = stories.filter(s => s.project_id !== projectId);
      localStorage.setItem(this.KEYS.USER_STORIES, JSON.stringify(filteredStories));
      console.log(`🧹 Cleared stories for project ${projectId}`);
    } catch (error) {
      console.error('Error clearing project stories:', error);
    }
  }

  // ===== WIREFRAME METHODS - UNIFIED STORAGE =====
  
  createWireframe(wireframeData: Omit<LocalWireframe, 'wireframe_id' | 'created_at' | 'updated_at'>, customId?: string): LocalWireframe {
    try {
      const wireframes = this.getAllWireframes();
      const wireframeId = customId || generateShortUUID();
      
      const wireframe: LocalWireframe = {
        ...wireframeData,
        wireframe_id: wireframeId,
        created_at: getCurrentTimestamp(),
        updated_at: getCurrentTimestamp(),
      };
      
      wireframes.push(wireframe);
      localStorage.setItem(this.KEYS.WIREFRAMES, JSON.stringify(wireframes));
      
      console.log('✅ Wireframe created in local_wireframes:', wireframeId);
      return wireframe;
    } catch (error) {
      console.error('❌ Error creating wireframe:', error);
      throw error;
    }
  }

  getWireframesByProject(projectId: string): LocalWireframe[] {
    const wireframes = this.getAllWireframes();
    const filtered = wireframes.filter(w => w.project_id === projectId);
    console.log(`🔍 Found ${filtered.length} wireframes for project ${projectId} in local_wireframes`);
    return filtered;
  }

  getAllWireframes(): LocalWireframe[] {
    try {
      const wireframesStr = localStorage.getItem(this.KEYS.WIREFRAMES);
      const wireframes = wireframesStr ? JSON.parse(wireframesStr) : [];
      console.log(`📋 Total wireframes in local_wireframes: ${wireframes.length}`);
      return wireframes;
    } catch (error) {
      console.error('❌ Error getting wireframes:', error);
      return [];
    }
  }

  updateWireframe(wireframeId: string, updates: Partial<LocalWireframe>): LocalWireframe | null {
    try {
      const wireframes = this.getAllWireframes();
      const wireframeIndex = wireframes.findIndex(w => w.wireframe_id === wireframeId);
      
      if (wireframeIndex === -1) {
        console.log('❌ Wireframe not found for update:', wireframeId);
        return null;
      }
      
      const updatedWireframe: LocalWireframe = {
        ...wireframes[wireframeIndex],
        ...updates,
        updated_at: getCurrentTimestamp(),
      };
      
      wireframes[wireframeIndex] = updatedWireframe;
      localStorage.setItem(this.KEYS.WIREFRAMES, JSON.stringify(wireframes));
      
      console.log('✅ Wireframe updated in local_wireframes:', wireframeId);
      return updatedWireframe;
    } catch (error) {
      console.error('❌ Error updating wireframe:', error);
      return null;
    }
  }

  deleteWireframe(wireframeId: string): boolean {
    try {
      const wireframes = this.getAllWireframes();
      const wireframeIndex = wireframes.findIndex(w => w.wireframe_id === wireframeId);
      
      if (wireframeIndex === -1) {
        console.log('❌ Wireframe not found for deletion:', wireframeId);
        return false;
      }
      
      wireframes.splice(wireframeIndex, 1);
      localStorage.setItem(this.KEYS.WIREFRAMES, JSON.stringify(wireframes));
      
      console.log('✅ Wireframe deleted from local_wireframes:', wireframeId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting wireframe:', error);
      return false;
    }
  }

  clearProjectWireframes(projectId: string): void {
    try {
      const wireframes = this.getAllWireframes();
      const filteredWireframes = wireframes.filter(w => w.project_id !== projectId);
      localStorage.setItem(this.KEYS.WIREFRAMES, JSON.stringify(filteredWireframes));
      console.log(`🧹 Cleared wireframes for project ${projectId} from local_wireframes`);
    } catch (error) {
      console.error('Error clearing project wireframes:', error);
    }
  }

  // ===== SCENARIO METHODS =====
  createScenario(scenarioData: Omit<LocalScenario, 'scenario_id' | 'created_at' | 'updated_at'>, scenarioId?: string): LocalScenario {
  try {
    const scenario: LocalScenario = {
      ...scenarioData,
      scenario_id: scenarioId || `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const scenarios = this.getAllScenarios();
    scenarios.push(scenario);
    localStorage.setItem('local_scenarios', JSON.stringify(scenarios));
    
    return scenario;
  } catch (error) {
    console.error('Error creating scenario:', error);
    throw error;
  }
}

  updateScenario(scenarioId: string, updates: Partial<LocalScenario>): boolean {
    try {
      const allScenarios = this.getAllScenarios();
      const scenarioIndex = allScenarios.findIndex(s => s.scenario_id === scenarioId);
      
      if (scenarioIndex === -1) {
        console.warn(`❌ Scenario ${scenarioId} not found in main storage`);
        return false;
      }
      
      allScenarios[scenarioIndex] = {
        ...allScenarios[scenarioIndex],
        ...updates,
        updated_at: getCurrentTimestamp(),
      };
      
      localStorage.setItem(this.KEYS.SCENARIOS, JSON.stringify(allScenarios));
      console.log(`✅ Updated scenario ${scenarioId} in main storage`);
      
      const projectId = allScenarios[scenarioIndex].project_id;
      const projectScenarios = this.getScenariosByProject(projectId);
      const projectIndex = projectScenarios.findIndex(s => s.scenario_id === scenarioId);
      
      if (projectIndex !== -1) {
        projectScenarios[projectIndex] = {
          ...projectScenarios[projectIndex],
          ...updates,
          updated_at: getCurrentTimestamp(),
        };
        
        this.saveScenariosToProject(projectId, projectScenarios);
        console.log(`✅ Updated scenario ${scenarioId} in project storage`);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating scenario:', error);
      return false;
    }
  }

  getScenariosByProject(projectId: string): LocalScenario[] {
    try {
      const projectKey = this.KEYS.SCENARIOS_BY_PROJECT(projectId);
      const scenariosStr = localStorage.getItem(projectKey);
      
      if (scenariosStr) {
        const scenarios = JSON.parse(scenariosStr);
        console.log(`📋 Found ${scenarios.length} scenarios in project storage for ${projectId}`);
        return scenarios;
      }
      
      const allScenarios = this.getAllScenarios();
      const filtered = allScenarios.filter(s => s.project_id === projectId);
      console.log(`📋 Found ${filtered.length} scenarios for project ${projectId} (from main storage)`);
      return filtered;
    } catch (error) {
      console.error('❌ Error getting scenarios by project:', error);
      return [];
    }
  }

  getAllScenarios(): LocalScenario[] {
    try {
      const scenariosStr = localStorage.getItem(this.KEYS.SCENARIOS);
      return scenariosStr ? JSON.parse(scenariosStr) : [];
    } catch (error) {
      console.error('❌ Error getting all scenarios:', error);
      return [];
    }
  }

  saveScenariosToProject(projectId: string, scenarios: LocalScenario[]): void {
    try {
      const projectKey = this.KEYS.SCENARIOS_BY_PROJECT(projectId);
      localStorage.setItem(projectKey, JSON.stringify(scenarios));
      console.log(`✅ Saved ${scenarios.length} scenarios to project storage: ${projectKey}`);
      
      const allScenarios = this.getAllScenarios();
      const newScenarios = scenarios.filter(scenario => 
        !allScenarios.some(s => s.scenario_id === scenario.scenario_id)
      );
      
      if (newScenarios.length > 0) {
        allScenarios.push(...newScenarios);
        localStorage.setItem(this.KEYS.SCENARIOS, JSON.stringify(allScenarios));
        console.log(`✅ Also added ${newScenarios.length} new scenarios to main storage`);
      }
    } catch (error) {
      console.error('Error saving scenarios to project:', error);
    }
  }

  saveSessionData(projectId: string, sessionData: any): void {
    try {
      const projectKey = this.KEYS.SESSIONS_BY_PROJECT(projectId);
      const existingSessions = JSON.parse(localStorage.getItem(projectKey) || '[]');
      existingSessions.push(sessionData);
      localStorage.setItem(projectKey, JSON.stringify(existingSessions));
      console.log(`✅ Saved session data for project ${projectId}`);
    } catch (error) {
      console.error('Error saving session data:', error);
    }
  }

  getSessionData(projectId: string): any[] {
    try {
      const projectKey = this.KEYS.SESSIONS_BY_PROJECT(projectId);
      return JSON.parse(localStorage.getItem(projectKey) || '[]');
    } catch (error) {
      console.error('Error getting session data:', error);
      return [];
    }
  }

  clearProjectScenarios(projectId: string): void {
    try {
      const allScenarios = this.getAllScenarios();
      const filtered = allScenarios.filter(s => s.project_id !== projectId);
      localStorage.setItem(this.KEYS.SCENARIOS, JSON.stringify(filtered));
      
      const projectKey = this.KEYS.SCENARIOS_BY_PROJECT(projectId);
      localStorage.removeItem(projectKey);
      
      const sessionKey = this.KEYS.SESSIONS_BY_PROJECT(projectId);
      localStorage.removeItem(sessionKey);
      
      console.log(`🗑️ Deleted all scenarios and sessions for project ${projectId}`);
    } catch (error) {
      console.error('Error deleting project scenarios:', error);
    }
  }

  // ===== STATISTICS =====
  getProjectStats(projectId: string) {
    const stats = {
      user_stories_count: this.getUserStoriesByProject(projectId).length,
      wireframes_count: this.getWireframesByProject(projectId).length,
      scenarios_count: this.getScenariosByProject(projectId).length,
    };
    console.log(`📊 Stats for project ${projectId}:`, stats);
    return stats;
  }

  // ===== CLEANUP & DEBUG METHODS =====
  
  private cleanupDuplicateStorage(): void {
    try {
      console.log('🔧 Checking for duplicate wireframe storage...');
      
      const allKeys = Object.keys(localStorage);
      const wireframeKeys = allKeys.filter(key => 
        key.toLowerCase().includes('wireframe') && 
        key !== this.KEYS.WIREFRAMES
      );
      
      if (wireframeKeys.length > 0) {
        console.log(`⚠️ Found ${wireframeKeys.length} duplicate wireframe keys:`, wireframeKeys);
        
        // Collect all wireframes from duplicates
        const allWireframes = this.getAllWireframes(); // Start with current wireframes
        
        wireframeKeys.forEach(key => {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const wireframes = JSON.parse(data);
              if (Array.isArray(wireframes)) {
                console.log(`📦 Found ${wireframes.length} wireframes in duplicate key: ${key}`);
                allWireframes.push(...wireframes);
              }
            }
          } catch (e) {
            console.log(`⚠️ Could not parse ${key}:`, e);
          }
          
          // Remove the duplicate key
          localStorage.removeItem(key);
          console.log(`🗑️ Removed duplicate key: ${key}`);
        });
        
        // Remove duplicates by wireframe_id
        const uniqueWireframes = Array.from(
          new Map(allWireframes.map(wf => [wf.wireframe_id, wf])).values()
        );
        
        // Save all unique wireframes
        localStorage.setItem(this.KEYS.WIREFRAMES, JSON.stringify(uniqueWireframes));
        console.log(`✅ Consolidated ${uniqueWireframes.length} wireframes to local_wireframes`);
      } else {
        console.log('✅ No duplicate wireframe storage found');
      }
    } catch (error) {
      console.error('Error cleaning up duplicate storage:', error);
    }
  }

  debugStorage(): void {
    console.log('=== 🐛 LOCALSTORAGE DEBUG ===');
    
    console.log('Defined storage keys:');
    console.log('- Current User:', localStorage.getItem(this.KEYS.CURRENT_USER) ? '✅' : '❌');
    console.log('- Projects:', localStorage.getItem(this.KEYS.PROJECTS) ? `${JSON.parse(localStorage.getItem(this.KEYS.PROJECTS) || '[]').length} items` : '❌');
    console.log('- User Stories:', localStorage.getItem(this.KEYS.USER_STORIES) ? `${JSON.parse(localStorage.getItem(this.KEYS.USER_STORIES) || '[]').length} items` : '❌');
    console.log('- Wireframes:', localStorage.getItem(this.KEYS.WIREFRAMES) ? `${JSON.parse(localStorage.getItem(this.KEYS.WIREFRAMES) || '[]').length} items` : '❌');
    console.log('- Scenarios:', localStorage.getItem(this.KEYS.SCENARIOS) ? `${JSON.parse(localStorage.getItem(this.KEYS.SCENARIOS) || '[]').length} items` : '❌');
    
    console.log('\nAll wireframe-related keys in localStorage:');
    const allKeys = Object.keys(localStorage);
    const wireframeKeys = allKeys.filter(key => key.toLowerCase().includes('wireframe'));
    wireframeKeys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        console.log(`- ${key}: ${Array.isArray(data) ? data.length : 1} items`);
      } catch {
        console.log(`- ${key}: [Non-JSON data]`);
      }
    });
    
    if (wireframeKeys.length > 1) {
      console.log('⚠️ WARNING: Multiple wireframe keys found! Run cleanupDuplicateStorage()');
    }
    
    console.log('=== DEBUG END ===');
  }

  clearAllData(): void {
    try {
      localStorage.removeItem(this.KEYS.CURRENT_USER);
      localStorage.removeItem(this.KEYS.PROJECTS);
      localStorage.removeItem(this.KEYS.USER_STORIES);
      localStorage.removeItem(this.KEYS.WIREFRAMES);
      localStorage.removeItem(this.KEYS.SCENARIOS);
      
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (key.startsWith('scenarios_') || key.startsWith('sessions_') || key.startsWith('wireframes_')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('🧹 All localStorage data cleared (unified storage)');
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }
}

export const localStorageService = LocalStorageService.getInstance();