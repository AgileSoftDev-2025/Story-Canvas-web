// frontend/src/services/projectService.ts
import { localStorageService } from '../utils/localStorageService';

export interface ProjectFormData {
  goal: string;
  users: string;
  fitur: string;
  alur: string;
  scope: string;
  info: string;
}

export interface CreateProjectRequest {
  title: string;
  objective: string;
  scope: string;
  flow: string;
  additional_info: string;
  domain: string;
  language: string;
  users_data: string[];
  features_data: string[];
  nlp_analysis: Record<string, any>;
  status: string;
}

class ProjectService {
  private baseURL = 'http://127.0.0.1:5173/api';

  // Untuk guest user - simpan di localStorage
  async createGuestProject(formData: ProjectFormData): Promise<string> {
    try {
      console.log('🟡 Starting guest project creation...');
      console.log('Form data received:', formData);

      let currentUser = localStorageService.getCurrentUser();

      if (!currentUser) {
        console.log('👤 No current user found, creating guest user...');
        currentUser = localStorageService.setCurrentUser({
          username: `guest_${Date.now()}`,
          email: `guest_${Date.now()}@example.com`,
          is_active: true,
          last_login: new Date().toISOString(),
        });
        console.log('✅ Guest user created:', currentUser.username);
      } else {
        console.log('✅ Using existing user:', currentUser.username);
      }

      const projectData = {
        user_id: currentUser.id,
        title: this.generateProjectTitle(formData.goal),
        objective: formData.goal,
        scope: formData.scope,
        flow: formData.alur,
        additional_info: formData.info,
        domain: "general",
        language: "en",
        nlp_analysis: {},
        users_data: formData.users.split(',').map(u => u.trim()).filter(u => u),
        features_data: formData.fitur.split(',').map(f => f.trim()).filter(f => f),
        status: 'draft' as const,
      };

      console.log('📦 Project data prepared:', projectData);

      const project = localStorageService.createProject(projectData);
      console.log('✅ Project creation completed:', project.project_id);

      // Debug: Verify the project was saved
      localStorageService.debugStorage();

      return project.project_id;

    } catch (error) {
      console.error('❌ Error creating guest project:', error);
      throw new Error('Failed to save project locally');
    }
  }

  // Untuk logged-in user - simpan ke database via API
  async createUserProject(formData: ProjectFormData, token: string): Promise<string> {
    try {
      console.log('🔵 Starting user project creation via API...');

      const projectRequest: CreateProjectRequest = {
        title: this.generateProjectTitle(formData.goal),
        objective: formData.goal,
        scope: formData.scope,
        flow: formData.alur,
        additional_info: formData.info,
        domain: "general",
        language: "en",
        users_data: formData.users.split(',').map(u => u.trim()).filter(u => u),
        features_data: formData.fitur.split(',').map(f => f.trim()).filter(f => f),
        nlp_analysis: {},
        status: 'draft'
      };

      console.log('📤 Sending API request:', projectRequest);

      const response = await fetch(`${this.baseURL}/projects/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(projectRequest),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch {
          // If response is not JSON, use default message
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create project');
      }

      const projectId = result.data.project_id;
      console.log('✅ User project created via API:', projectId);

      // ✅ SAVE ONLY PROJECT ID TO LOCALSTORAGE FOR QUICK ACCESS
      this.saveUserProjectId(projectId);

      return projectId;

    } catch (error) {
      console.error('❌ Error creating user project:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create project');
    }
  }

  // Save user project IDs to localStorage
  private saveUserProjectId(projectId: string): void {
    try {
      const userProjects = this.getUserProjectIds();
      if (!userProjects.includes(projectId)) {
        userProjects.push(projectId);
        localStorage.setItem('user_project_ids', JSON.stringify(userProjects));
        console.log('💾 Saved user project ID to localStorage:', projectId);
      }
    } catch (error) {
      console.warn('⚠️ Could not save project ID to localStorage:', error);
    }
  }

  // Get all user project IDs from localStorage
  getUserProjectIds(): string[] {
    try {
      const projectsStr = localStorage.getItem('user_project_ids');
      return projectsStr ? JSON.parse(projectsStr) : [];
    } catch (error) {
      console.error('❌ Error getting user project IDs:', error);
      return [];
    }
  }

  // Check if a project belongs to the logged-in user
  isUserProject(projectId: string): boolean {
    const userProjects = this.getUserProjectIds();
    return userProjects.includes(projectId);
  }


  // ✅ Public method untuk generate project title
  public generateProjectTitle(goal: string): string {
    if (!goal.trim()) {
      return `Project ${new Date().toLocaleDateString('id-ID')}`;
    }
    const words = goal.split(/\s+/).slice(0, 4).join(' ');
    return `${words}`;
  }

  // Validasi form data
  validateFormData(formData: ProjectFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!formData.goal.trim()) {
      errors.push('Main goal is required');
    } else if (formData.goal.trim().length < 10) {
      errors.push('Main goal must be at least 10 characters long');
    }

    if (!formData.users.trim()) {
      errors.push('Target users is required');
    } else if (formData.users.trim().length < 3) {
      errors.push('Please specify at least one user type');
    }

    if (!formData.fitur.trim()) {
      errors.push('Key features is required');
    }

    if (!formData.alur.trim()) {
      errors.push('User flow is required');
    }

    if (!formData.scope.trim()) {
      errors.push('Project scope is required');
    }

    if (!formData.info.trim()) {
      errors.push('Additional information is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get project by ID (for both guest and user modes)
  // Get project by ID (intelligent detection)
  async getProject(projectId: string, token?: string): Promise<any> {
    // First check if it's a user project
    if (this.isUserProject(projectId) && token) {
      console.log('🔵 Fetching user project from API:', projectId);

      // For logged-in users, fetch from API
      const response = await fetch(`${this.baseURL}/projects/${projectId}/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch project from API');
      }

      const result = await response.json();
      return result.data;
    } else {
      // For guest users or non-user projects, get from localStorage
      console.log('👤 Fetching project from localStorage:', projectId);
      const project = localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      return project;
    }
  }
}

export const projectService = new ProjectService();