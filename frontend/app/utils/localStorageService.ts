// frontend/src/utils/localStorageService.ts
import type {
  LocalUser,
  LocalProject,
  LocalUserStory,
  LocalWireframe,
  LocalScenario,
  LocalGenerationSession,
  LocalProjectHistory,
  LocalExport,
  CreateProjectHistoryData
} from './localStorageModels';

// Helper functions untuk generate ID seperti Django
const generateShortUUID = (): string => {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

// Main Local Storage Service
export class LocalStorageService {
  private static instance: LocalStorageService;
  
  // Storage keys
  private readonly KEYS = {
    CURRENT_USER: 'current_user',
    PROJECTS: 'local_projects',
    USER_STORIES: 'local_user_stories',
    WIREFRAMES: 'local_wireframes',
    SCENARIOS: 'local_scenarios',
    GENERATION_SESSIONS: 'local_generation_sessions',
    PROJECT_HISTORY: 'local_project_history',
    EXPORTS: 'local_exports',
  };

  private constructor() {}

  public static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  // ===== USER OPERATIONS =====
  setCurrentUser(user: Omit<LocalUser, 'id' | 'created_at' | 'updated_at'>): LocalUser {
    const userData: LocalUser = {
      ...user,
      id: generateShortUUID(),
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    localStorage.setItem(this.KEYS.CURRENT_USER, JSON.stringify(userData));
    return userData;
  }

  getCurrentUser(): LocalUser | null {
    const userStr = localStorage.getItem(this.KEYS.CURRENT_USER);
    return userStr ? JSON.parse(userStr) : null;
  }

  clearCurrentUser(): void {
    localStorage.removeItem(this.KEYS.CURRENT_USER);
  }

  // ===== PROJECT OPERATIONS =====
  createProject(projectData: Omit<LocalProject, 'project_id' | 'created_at' | 'updated_at'>): LocalProject {
    const projects = this.getAllProjects();
    const project: LocalProject = {
      ...projectData,
      project_id: generateShortUUID(),
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    projects.push(project);
    localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
    
    // Add to project history
    this.addProjectHistory({
      project_id: project.project_id,
      user_id: project.user_id,
      action_type: 'project_created',
      action_details: { title: project.title },
      description: `Project "${project.title}" created`,
    });
    
    return project;
  }

  getProject(projectId: string): LocalProject | null {
    const projects = this.getAllProjects();
    return projects.find(p => p.project_id === projectId) || null;
  }

  getAllProjects(): LocalProject[] {
    const projectsStr = localStorage.getItem(this.KEYS.PROJECTS);
    return projectsStr ? JSON.parse(projectsStr) : [];
  }

  updateProject(projectId: string, updates: Partial<LocalProject>): LocalProject | null {
    const projects = this.getAllProjects();
    const projectIndex = projects.findIndex(p => p.project_id === projectId);
    
    if (projectIndex === -1) return null;
    
    const updatedProject: LocalProject = {
      ...projects[projectIndex],
      ...updates,
      updated_at: getCurrentTimestamp(),
    };
    
    projects[projectIndex] = updatedProject;
    localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
    
    // Add to project history
    this.addProjectHistory({
      project_id: projectId,
      user_id: updatedProject.user_id,
      action_type: 'project_updated',
      action_details: updates,
      description: `Project "${updatedProject.title}" updated`,
    });
    
    return updatedProject;
  }

  deleteProject(projectId: string): boolean {
    const projects = this.getAllProjects();
    const projectIndex = projects.findIndex(p => p.project_id === projectId);
    
    if (projectIndex === -1) return false;
    
    // Also delete related data
    this.deleteProjectUserStories(projectId);
    this.deleteProjectWireframes(projectId);
    this.deleteProjectScenarios(projectId);
    this.deleteProjectHistory(projectId);
    this.deleteProjectExports(projectId);
    this.deleteProjectSessions(projectId);
    
    projects.splice(projectIndex, 1);
    localStorage.setItem(this.KEYS.PROJECTS, JSON.stringify(projects));
    
    return true;
  }

  // ===== USER STORY OPERATIONS =====
  createUserStory(storyData: Omit<LocalUserStory, 'story_id' | 'created_at' | 'updated_at'>): LocalUserStory {
    const stories = this.getAllUserStories();
    const story: LocalUserStory = {
      ...storyData,
      story_id: generateShortUUID(),
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    stories.push(story);
    localStorage.setItem(this.KEYS.USER_STORIES, JSON.stringify(stories));
    
    return story;
  }

  getUserStory(storyId: string): LocalUserStory | null {
    const stories = this.getAllUserStories();
    return stories.find(s => s.story_id === storyId) || null;
  }

  getUserStoriesByProject(projectId: string): LocalUserStory[] {
    const stories = this.getAllUserStories();
    return stories.filter(s => s.project_id === projectId);
  }

  getAllUserStories(): LocalUserStory[] {
    const storiesStr = localStorage.getItem(this.KEYS.USER_STORIES);
    return storiesStr ? JSON.parse(storiesStr) : [];
  }

  private deleteProjectUserStories(projectId: string): void {
    const stories = this.getAllUserStories();
    const filteredStories = stories.filter(s => s.project_id !== projectId);
    localStorage.setItem(this.KEYS.USER_STORIES, JSON.stringify(filteredStories));
  }

  // ===== WIREFRAME OPERATIONS =====
  createWireframe(wireframeData: Omit<LocalWireframe, 'wireframe_id' | 'created_at' | 'updated_at'>): LocalWireframe {
    const wireframes = this.getAllWireframes();
    const wireframe: LocalWireframe = {
      ...wireframeData,
      wireframe_id: generateShortUUID(),
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    wireframes.push(wireframe);
    localStorage.setItem(this.KEYS.WIREFRAMES, JSON.stringify(wireframes));
    
    return wireframe;
  }

  getWireframesByProject(projectId: string): LocalWireframe[] {
    const wireframes = this.getAllWireframes();
    return wireframes.filter(w => w.project_id === projectId);
  }

  getAllWireframes(): LocalWireframe[] {
    const wireframesStr = localStorage.getItem(this.KEYS.WIREFRAMES);
    return wireframesStr ? JSON.parse(wireframesStr) : [];
  }

  private deleteProjectWireframes(projectId: string): void {
    const wireframes = this.getAllWireframes();
    const filteredWireframes = wireframes.filter(w => w.project_id !== projectId);
    localStorage.setItem(this.KEYS.WIREFRAMES, JSON.stringify(filteredWireframes));
  }

  // ===== SCENARIO OPERATIONS =====
  createScenario(scenarioData: Omit<LocalScenario, 'scenario_id' | 'created_at' | 'updated_at'>): LocalScenario {
    const scenarios = this.getAllScenarios();
    const scenario: LocalScenario = {
      ...scenarioData,
      scenario_id: generateShortUUID(),
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    scenarios.push(scenario);
    localStorage.setItem(this.KEYS.SCENARIOS, JSON.stringify(scenarios));
    
    return scenario;
  }

  getScenariosByProject(projectId: string): LocalScenario[] {
    const scenarios = this.getAllScenarios();
    return scenarios.filter(s => s.project_id === projectId);
  }

  getScenariosByUserStory(storyId: string): LocalScenario[] {
    const scenarios = this.getAllScenarios();
    return scenarios.filter(s => s.user_story_id === storyId);
  }

  getAllScenarios(): LocalScenario[] {
    const scenariosStr = localStorage.getItem(this.KEYS.SCENARIOS);
    return scenariosStr ? JSON.parse(scenariosStr) : [];
  }

  private deleteProjectScenarios(projectId: string): void {
    const scenarios = this.getAllScenarios();
    const filteredScenarios = scenarios.filter(s => s.project_id !== projectId);
    localStorage.setItem(this.KEYS.SCENARIOS, JSON.stringify(filteredScenarios));
  }

  // ===== GENERATION SESSION OPERATIONS =====
  createGenerationSession(sessionData: Omit<LocalGenerationSession, 'session_id' | 'created_at' | 'updated_at'>): LocalGenerationSession {
    const sessions = this.getAllGenerationSessions();
    const session: LocalGenerationSession = {
      ...sessionData,
      session_id: generateShortUUID(),
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    sessions.push(session);
    localStorage.setItem(this.KEYS.GENERATION_SESSIONS, JSON.stringify(sessions));
    
    return session;
  }

  getAllGenerationSessions(): LocalGenerationSession[] {
    const sessionsStr = localStorage.getItem(this.KEYS.GENERATION_SESSIONS);
    return sessionsStr ? JSON.parse(sessionsStr) : [];
  }

  private deleteProjectSessions(projectId: string): void {
    const sessions = this.getAllGenerationSessions();
    const filteredSessions = sessions.filter(s => s.project_id !== projectId);
    localStorage.setItem(this.KEYS.GENERATION_SESSIONS, JSON.stringify(filteredSessions));
  }

  // ===== PROJECT HISTORY OPERATIONS =====
  private addProjectHistory(historyData: CreateProjectHistoryData): LocalProjectHistory {
    const history = this.getAllProjectHistory();
    const historyEntry: LocalProjectHistory = {
      ...historyData,
      history_id: generateShortUUID(),
      generation_session_id: historyData.generation_session_id || null,
      related_story_id: historyData.related_story_id || null,
      related_wireframe_id: historyData.related_wireframe_id || null,
      related_scenario_id: historyData.related_scenario_id || null,
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    history.push(historyEntry);
    localStorage.setItem(this.KEYS.PROJECT_HISTORY, JSON.stringify(history));
    
    return historyEntry;
  }

  getProjectHistory(projectId: string): LocalProjectHistory[] {
    const history = this.getAllProjectHistory();
    return history.filter(h => h.project_id === projectId);
  }

  private getAllProjectHistory(): LocalProjectHistory[] {
    const historyStr = localStorage.getItem(this.KEYS.PROJECT_HISTORY);
    return historyStr ? JSON.parse(historyStr) : [];
  }

  private deleteProjectHistory(projectId: string): void {
    const history = this.getAllProjectHistory();
    const filteredHistory = history.filter(h => h.project_id !== projectId);
    localStorage.setItem(this.KEYS.PROJECT_HISTORY, JSON.stringify(filteredHistory));
  }

  // ===== EXPORT OPERATIONS =====
  createExport(exportData: Omit<LocalExport, 'export_id' | 'created_at' | 'updated_at'>): LocalExport {
    const exports = this.getAllExports();
    const exportEntry: LocalExport = {
      ...exportData,
      export_id: generateShortUUID(),
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    
    exports.push(exportEntry);
    localStorage.setItem(this.KEYS.EXPORTS, JSON.stringify(exports));
    
    return exportEntry;
  }

  getExportsByProject(projectId: string): LocalExport[] {
    const exports = this.getAllExports();
    return exports.filter(e => e.project_id === projectId);
  }

  private getAllExports(): LocalExport[] {
    const exportsStr = localStorage.getItem(this.KEYS.EXPORTS);
    return exportsStr ? JSON.parse(exportsStr) : [];
  }

  private deleteProjectExports(projectId: string): void {
    const exports = this.getAllExports();
    const filteredExports = exports.filter(e => e.project_id !== projectId);
    localStorage.setItem(this.KEYS.EXPORTS, JSON.stringify(filteredExports));
  }

  // ===== STATISTICS =====
  getProjectStats(projectId: string) {
    return {
      user_stories_count: this.getUserStoriesByProject(projectId).length,
      wireframes_count: this.getWireframesByProject(projectId).length,
      scenarios_count: this.getScenariosByProject(projectId).length,
      sessions_count: this.getAllGenerationSessions().filter(s => s.project_id === projectId).length,
      exports_count: this.getExportsByProject(projectId).length,
    };
  }

  // ===== CLEANUP =====
  clearAllData(): void {
    Object.values(this.KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // New method to get complete project data for migration
  getCompleteProjectData(projectId: string) {
    const project = this.getProject(projectId);
    if (!project) return null;

    return {
      ...project,
      user_stories: this.getUserStoriesByProject(projectId),
      wireframes: this.getWireframesByProject(projectId),
      scenarios: this.getScenariosByProject(projectId),
      generation_sessions: this.getAllGenerationSessions().filter(s => s.project_id === projectId),
      project_history: this.getProjectHistory(projectId),
      exports: this.getExportsByProject(projectId)
    };
  }

  // New method to get all local data for complete sync
  getAllLocalData() {
    return {
      projects: this.getAllProjects(),
      user_stories: this.getAllUserStories(),
      wireframes: this.getAllWireframes(),
      scenarios: this.getAllScenarios(),
      generation_sessions: this.getAllGenerationSessions(),
      project_history: this.getAllProjectHistory(),
      exports: this.getAllExports()
    };
  }
}

// Export singleton instance
export const localStorageService = LocalStorageService.getInstance();