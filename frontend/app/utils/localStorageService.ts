// frontend/src/utils/localStorageService.ts
import type {
  LocalUser,
  LocalProject,
  LocalUserStory,
  LocalWireframe,
  LocalScenario
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
    WIREFRAMES: 'local_wireframes',
    SCENARIOS: 'local_scenarios',
  };

  private constructor() {
    console.log('🔄 LocalStorageService initialized');
  }

  public static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }
  
  // ===== PROJECT OPERATIONS =====
// Add this method to your LocalStorageService class
saveProject(projectData: Omit<LocalProject, 'project_id' | 'created_at' | 'updated_at'> & { 
  project_id?: string 
}): LocalProject {
  console.log('💾 Saving project:', projectData);
  
  try {
    // If project_id exists, it's an update
    if (projectData.project_id) {
      const { project_id, ...updates } = projectData;
      const updatedProject = this.updateProject(project_id, updates);
      if (!updatedProject) {
        throw new Error(`Project with ID ${project_id} not found`);
      }
      return updatedProject;
    } 
    // Otherwise, it's a create
    else {
      // Remove any optional fields that shouldn't be in create
      const { is_guest_project, user_specific, ...createData } = projectData;
      return this.createProject(createData);
    }
  } catch (error) {
    console.error('❌ Error saving project:', error);
    throw error;
  }
}

  // ===== USER OPERATIONS =====
  setCurrentUser(user: Omit<LocalUser, 'id' | 'created_at' | 'updated_at'>): LocalUser {
    console.log('👤 Setting current user:', user.username);
    const userData: LocalUser = {
      ...user,
      id: generateShortUUID(),
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    try {
      localStorage.setItem(this.KEYS.CURRENT_USER, JSON.stringify(userData));
      console.log('✅ User saved to localStorage:', userData);
      return userData;
    } catch (error) {
      console.error('❌ Error saving user to localStorage:', error);
      throw error;
    }
  }

  getCurrentUser(): LocalUser | null {
    try {
      const userStr = localStorage.getItem(this.KEYS.CURRENT_USER);
      const user = userStr ? JSON.parse(userStr) : null;
      console.log('👤 Retrieved current user:', user);
      return user;
    } catch (error) {
      console.error('❌ Error getting user from localStorage:', error);
      return null;
    }
  }

  clearCurrentUser(): void {
    localStorage.removeItem(this.KEYS.CURRENT_USER);
    console.log('✅ Current user cleared from localStorage');
  }

  // ===== PROJECT OPERATIONS =====
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
      
      console.log('📦 New project to save:', project);
      
      projects.push(project);
      localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
      
      console.log('✅ Project saved. Total projects:', projects.length);
      
      // Verify the save worked
      const verifyProjects = this.getAllProjects();
      console.log('📋 Projects in localStorage after save:', verifyProjects.length);
      
      return project;
    } catch (error) {
      console.error('❌ Error creating project:', error);
      throw error;
    }
  }

  getProject(projectId: string): LocalProject | null {
  try {
    const projects = this.getAllProjects();
    const project = projects.find(p => p.project_id === projectId) || null;
    
    // Don't return user projects from localStorage
    if (project && project.user_specific) {
      console.log(`🔒 Project ${projectId} is user-specific, not returning from localStorage`);
      return null;
    }
    
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
    
    // Filter out user projects (they should come from API)
    const guestProjects = projects.filter((p: LocalProject) => !p.user_specific);
    
    console.log(`📚 Retrieved ${guestProjects.length} guest projects from localStorage`);
    return guestProjects;
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
      this.deleteProjectUserStories(projectId);
      this.deleteProjectWireframes(projectId);
      this.deleteProjectScenarios(projectId);
      
      projects.splice(projectIndex, 1);
      localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
      
      console.log('✅ Project deleted:', projectId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting project:', error);
      return false;
    }
  }

  // ===== USER STORY OPERATIONS =====
  createUserStory(storyData: Omit<LocalUserStory, 'story_id' | 'created_at' | 'updated_at'>): LocalUserStory {
    try {
      const stories = this.getAllUserStories();
      const story: LocalUserStory = {
        ...storyData,
        story_id: generateShortUUID(),
        created_at: getCurrentTimestamp(),
        updated_at: getCurrentTimestamp(),
      };
      
      stories.push(story);
      localStorage.setItem(this.KEYS.USER_STORIES, JSON.stringify(stories));
      console.log('✅ User story created:', story.story_id);
      return story;
    } catch (error) {
      console.error('❌ Error creating user story:', error);
      throw error;
    }
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
      return storiesStr ? JSON.parse(storiesStr) : [];
    } catch (error) {
      console.error('❌ Error getting user stories:', error);
      return [];
    }
  }

  private deleteProjectUserStories(projectId: string): void {
    const stories = this.getAllUserStories();
    const filteredStories = stories.filter(s => s.project_id !== projectId);
    localStorage.setItem(this.KEYS.USER_STORIES, JSON.stringify(filteredStories));
    console.log(`🗑️ Deleted user stories for project ${projectId}`);
  }

  // ===== WIREFRAME OPERATIONS =====
  createWireframe(wireframeData: Omit<LocalWireframe, 'wireframe_id' | 'created_at' | 'updated_at'>): LocalWireframe {
    try {
      const wireframes = this.getAllWireframes();
      const wireframe: LocalWireframe = {
        ...wireframeData,
        wireframe_id: generateShortUUID(),
        created_at: getCurrentTimestamp(),
        updated_at: getCurrentTimestamp(),
      };
      
      wireframes.push(wireframe);
      localStorage.setItem(this.KEYS.WIREFRAMES, JSON.stringify(wireframes));
      console.log('✅ Wireframe created:', wireframe.wireframe_id);
      return wireframe;
    } catch (error) {
      console.error('❌ Error creating wireframe:', error);
      throw error;
    }
  }

  getWireframesByProject(projectId: string): LocalWireframe[] {
    const wireframes = this.getAllWireframes();
    return wireframes.filter(w => w.project_id === projectId);
  }

  getAllWireframes(): LocalWireframe[] {
    try {
      const wireframesStr = localStorage.getItem(this.KEYS.WIREFRAMES);
      return wireframesStr ? JSON.parse(wireframesStr) : [];
    } catch (error) {
      console.error('❌ Error getting wireframes:', error);
      return [];
    }
  }

  private deleteProjectWireframes(projectId: string): void {
    const wireframes = this.getAllWireframes();
    const filteredWireframes = wireframes.filter(w => w.project_id !== projectId);
    localStorage.setItem(this.KEYS.WIREFRAMES, JSON.stringify(filteredWireframes));
  }

  // ===== SCENARIO OPERATIONS =====
  createScenario(scenarioData: Omit<LocalScenario, 'scenario_id' | 'created_at' | 'updated_at'>): LocalScenario {
    try {
      const scenarios = this.getAllScenarios();
      const scenario: LocalScenario = {
        ...scenarioData,
        scenario_id: generateShortUUID(),
        created_at: getCurrentTimestamp(),
        updated_at: getCurrentTimestamp(),
      };
      
      scenarios.push(scenario);
      localStorage.setItem(this.KEYS.SCENARIOS, JSON.stringify(scenarios));
      console.log('✅ Scenario created:', scenario.scenario_id);
      return scenario;
    } catch (error) {
      console.error('❌ Error creating scenario:', error);
      throw error;
    }
  }

  getScenariosByProject(projectId: string): LocalScenario[] {
    const scenarios = this.getAllScenarios();
    return scenarios.filter(s => s.project_id === projectId);
  }

  getAllScenarios(): LocalScenario[] {
    try {
      const scenariosStr = localStorage.getItem(this.KEYS.SCENARIOS);
      return scenariosStr ? JSON.parse(scenariosStr) : [];
    } catch (error) {
      console.error('❌ Error getting scenarios:', error);
      return [];
    }
  }

  private deleteProjectScenarios(projectId: string): void {
    const scenarios = this.getAllScenarios();
    const filteredScenarios = scenarios.filter(s => s.project_id !== projectId);
    localStorage.setItem(this.KEYS.SCENARIOS, JSON.stringify(filteredScenarios));
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

  // ===== CLEANUP =====
  clearAllData(): void {
    Object.values(this.KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🧹 All localStorage data cleared');
  }

  // ===== DEBUG METHODS =====
  debugStorage(): void {
    console.log('=== 🐛 LOCALSTORAGE DEBUG ===');
    Object.keys(this.KEYS).forEach(key => {
      const value = localStorage.getItem(this.KEYS[key as keyof typeof this.KEYS]);
      console.log(`Key: ${key}`, value ? JSON.parse(value) : 'Empty');
    });
    console.log('=== DEBUG END ===');
  }
}

export const localStorageService = LocalStorageService.getInstance();