// frontend/src/services/projectMigrationService.ts
import { localStorageService } from '../utils/localStorageService';
import type { LocalProject } from '../utils/localStorageModels';

export class ProjectMigrationService {
  static async migrateGuestProject(projectId: string, token: string): Promise<any> {
    const project: LocalProject | null = localStorageService.getProject(projectId);
    
    if (!project) {
      throw new Error('Project not found in local storage');
    }

    // Get all related data
    const userStories = localStorageService.getUserStoriesByProject(projectId);
    const wireframes = localStorageService.getWireframesByProject(projectId);
    const scenarios = localStorageService.getScenariosByProject(projectId);

    const migrationData = {
      project_data: {
        ...project,
        user_stories: userStories,
        wireframes: wireframes,
        scenarios: scenarios
      }
    };

    const response = await fetch('/api/projects/migrate-guest/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(migrationData),
    });

    if (!response.ok) {
      throw new Error('Migration failed');
    }

    const result = await response.json();
    
    // Remove from local storage after successful migration
    if (result.success) {
      localStorageService.deleteProject(projectId);
    }

    return result;
  }

  static async syncAllLocalProjects(token: string): Promise<any> {
    const localProjects: LocalProject[] = localStorageService.getAllProjects();
    
    const syncData = {
      projects: localProjects.map((project: LocalProject) => ({
        title: project.title,
        objective: project.objective,
        scope: project.scope,
        flow: project.flow,
        additional_info: project.additional_info,
        domain: project.domain,
        language: project.language,
        users_data: project.users_data,
        features_data: project.features_data,
        nlp_analysis: project.nlp_analysis,
        status: project.status
      }))
    };

    const response = await fetch('/api/projects/sync-local/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(syncData),
    });

    if (!response.ok) {
      throw new Error('Sync failed');
    }

    const result = await response.json();
    
    // Clear local storage after successful sync
    if (result.success) {
      localStorageService.clearAllData();
    }

    return result;
  }

  static hasLocalProjects(): boolean {
    const projects: LocalProject[] = localStorageService.getAllProjects();
    return projects.length > 0;
  }

  static getLocalProjectsCount(): number {
    const projects: LocalProject[] = localStorageService.getAllProjects();
    return projects.length;
  }

  static getLocalProjectsPreview(): Array<{
    project_id: string;
    title: string;
    objective: string;
    created_at: string;
    statistics: {
      user_stories: number;
      wireframes: number;
      scenarios: number;
    };
  }> {
    const projects: LocalProject[] = localStorageService.getAllProjects();
    return projects.map(project => ({
      project_id: project.project_id,
      title: project.title,
      objective: project.objective,
      created_at: project.created_at,
      statistics: {
        user_stories: localStorageService.getUserStoriesByProject(project.project_id).length,
        wireframes: localStorageService.getWireframesByProject(project.project_id).length,
        scenarios: localStorageService.getScenariosByProject(project.project_id).length,
      }
    }));
  }
}