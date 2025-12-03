import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { localStorageService } from "../../utils/localStorageService";
import type { LocalUserStory, LocalProject } from "../../utils/localStorageModels";
import { useAuth } from "../../context/AuthContext";

// Interface untuk form data
interface UserStoryFormData {
  story_text: string;
  role: string;
  action: string;
  benefit: string;
  feature: string;
  acceptance_criteria: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  story_points: number;
  status: 'draft' | 'reviewed' | 'approved' | 'implemented';
}

// Service untuk handle semua operasi user story
class UserStoryService {
  private static instance: UserStoryService;

  public static getInstance(): UserStoryService {
    if (!UserStoryService.instance) {
      UserStoryService.instance = new UserStoryService();
    }
    return UserStoryService.instance;
  }

  // NEW: Unified method that handles both online and offline modes
  async generateUserStories(projectId: string, projectData?: LocalProject): Promise<any> {
    const isAuthenticated = !!localStorage.getItem('access_token');
    
    if (isAuthenticated) {
      console.log('🟢 ONLINE MODE: Using authenticated API');
      return await this.generateUserStoriesOnline(projectId);
    } else {
      console.log('🟡 OFFLINE MODE: Using local project API');
      return await this.generateUserStoriesOfflineAPI(projectId, projectData);
    }
  }

  // Generate user stories via API (authenticated) - KEEP EXISTING
  async generateUserStoriesOnline(projectId: string): Promise<any> {
    try {
      console.log('Attempting to generate user stories for project:', projectId);

      const token = localStorage.getItem('access_token');
      if (!token) {
        console.warn('No authentication token found, using offline mode');
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/projects/${projectId}/generate-user-stories/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('API Response data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Generation failed on server');
      }

      if (data.data) {
        this.syncAPIDataToLocalStorage(data.data, projectId);
      }

      return data;
    } catch (error) {
      console.error('Error generating user stories online:', error);
      throw error;
    }
  }

  // NEW: Generate user stories via API for local projects (no auth required)
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

      console.log('Sending project data to local API:', apiProjectData);

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

      console.log('Local API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Local API Error:', errorText);
        throw new Error(`Local API error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('Local API Response data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Local generation failed on server');
      }

      // Save the generated stories to localStorage
      if (data.stories && Array.isArray(data.stories)) {
        this.saveStoriesToLocalStorage(data.stories, projectId);
        console.log(`✅ Saved ${data.stories.length} stories to localStorage`);
      }

      return data;
    } catch (error) {
      console.error('Error generating user stories via local API:', error);
      
      console.log('🔄 Falling back to template-based generation');
      return this.generateUserStoriesOfflineFallback(projectId);
    }
  }

  // NEW: Fallback to template generation when API fails
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
      console.error('Template generation also failed:', error);
      throw error;
    }
  }

  // NEW: Save API stories to localStorage
  private saveStoriesToLocalStorage(apiStories: any[], projectId: string): void {
    try {
      console.log('💾 Saving API stories to localStorage');
      
      // Clear existing stories for this project
      const existingStories = localStorageService.getUserStoriesByProject(projectId);
      existingStories.forEach(story => {
        localStorageService.deleteUserStory(story.story_id);
      });

      // Save new stories
      apiStories.forEach((apiStory: any) => {
        const localStory: Omit<LocalUserStory, 'story_id' | 'created_at' | 'updated_at'> = {
          project_id: projectId,
          story_text: apiStory.story_text || apiStory.text || '',
          role: apiStory.role || 'User',
          action: apiStory.action || this.extractActionFromStory(apiStory.story_text || apiStory.text || ''),
          benefit: apiStory.benefit || this.extractBenefitFromStory(apiStory.story_text || apiStory.text || ''),
          feature: apiStory.feature || 'General',
          acceptance_criteria: apiStory.acceptance_criteria || [],
          priority: (apiStory.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
          story_points: apiStory.story_points || 0,
          status: (apiStory.status as 'draft' | 'reviewed' | 'approved' | 'implemented') || 'draft',
          generated_by_llm: apiStory.generated_by_llm !== undefined ? apiStory.generated_by_llm : true,
          iteration: apiStory.iteration || 1
        };

        localStorageService.createUserStory(localStory);
      });
      
      console.log(`✅ Successfully saved ${apiStories.length} stories to localStorage`);
    } catch (error) {
      console.error('Failed to save stories to localStorage:', error);
    }
  }

  // NEW: Helper methods for story parsing
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

  // KEEP ALL EXISTING METHODS - NO CHANGES BELOW THIS LINE

  // Generate user stories offline (template-based) - KEEP EXISTING
  generateUserStoriesOffline(project: LocalProject): LocalUserStory[] {
    console.log('Generating user stories offline for project:', project);

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

    console.log(`Generated ${userStories.length} user stories offline`);
    return userStories;
  }

  // Sync API data to localStorage - KEEP EXISTING
  private syncAPIDataToLocalStorage(apiStories: any[], projectId: string): void {
    try {
      console.log('Syncing API data to localStorage');
      apiStories.forEach((apiStory: any) => {
        const existingStories = localStorageService.getUserStoriesByProject(projectId);
        const existingStory = existingStories.find(s => s.story_id === apiStory.story_id);

        if (!existingStory) {
          const localStory: Omit<LocalUserStory, 'story_id' | 'created_at' | 'updated_at'> = {
            project_id: apiStory.project_id || projectId,
            story_text: apiStory.story_text,
            role: apiStory.role,
            action: apiStory.action,
            benefit: apiStory.benefit,
            feature: apiStory.feature,
            acceptance_criteria: apiStory.acceptance_criteria || [],
            priority: (apiStory.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
            story_points: apiStory.story_points || 0,
            status: (apiStory.status as 'draft' | 'reviewed' | 'approved' | 'implemented') || 'draft',
            generated_by_llm: apiStory.generated_by_llm || false,
            iteration: apiStory.iteration || 1
          };

          localStorageService.createUserStory(localStory);
        }
      });
    } catch (error) {
      console.warn('Failed to sync API data to localStorage:', error);
    }
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

// Komponen Modal untuk Create/Edit User Story
const UserStoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (storyData: any) => void;
  editingStory?: LocalUserStory | null;
}> = ({ isOpen, onClose, onSave, editingStory }) => {
  const [formData, setFormData] = useState<UserStoryFormData>({
    story_text: editingStory?.story_text || '',
    role: editingStory?.role || '',
    action: editingStory?.action || '',
    benefit: editingStory?.benefit || '',
    feature: editingStory?.feature || '',
    acceptance_criteria: editingStory?.acceptance_criteria?.join('\n') || '',
    priority: editingStory?.priority || 'medium',
    story_points: editingStory?.story_points || 0,
    status: editingStory?.status || 'draft'
  });

  useEffect(() => {
    if (editingStory) {
      setFormData({
        story_text: editingStory.story_text,
        role: editingStory.role,
        action: editingStory.action,
        benefit: editingStory.benefit,
        feature: editingStory.feature,
        acceptance_criteria: editingStory.acceptance_criteria?.join('\n') || '',
        priority: editingStory.priority,
        story_points: editingStory.story_points,
        status: editingStory.status
      });
    }
  }, [editingStory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const storyData = {
      ...formData,
      acceptance_criteria: formData.acceptance_criteria.split('\n').filter(line => line.trim())
    };
    onSave(storyData);
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'low' | 'medium' | 'high' | 'critical';
    setFormData(prev => ({ ...prev, priority: value }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'draft' | 'reviewed' | 'approved' | 'implemented';
    setFormData(prev => ({ ...prev, status: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {editingStory ? 'Edit User Story' : 'Create New User Story'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Story Text *
            </label>
            <textarea
              value={formData.story_text}
              onChange={(e) => setFormData({ ...formData, story_text: e.target.value })}
              required
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4699DF] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="As a [role], I want to [action] so that I can [benefit]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role *
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4699DF] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., user, admin, customer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Feature
              </label>
              <input
                type="text"
                value={formData.feature}
                onChange={(e) => setFormData({ ...formData, feature: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4699DF] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., Authentication, Dashboard"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Action *
            </label>
            <textarea
              value={formData.action}
              onChange={(e) => setFormData({ ...formData, action: e.target.value })}
              required
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4699DF] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="What the user wants to do..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Benefit *
            </label>
            <textarea
              value={formData.benefit}
              onChange={(e) => setFormData({ ...formData, benefit: e.target.value })}
              required
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4699DF] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="The value or outcome the user expects..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={handlePriorityChange}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4699DF] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Story Points
              </label>
              <input
                type="number"
                value={formData.story_points}
                onChange={(e) => setFormData({ ...formData, story_points: parseInt(e.target.value) || 0 })}
                min="0"
                max="100"
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4699DF] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={handleStatusChange}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4699DF] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="draft">Draft</option>
                <option value="reviewed">Reviewed</option>
                <option value="approved">Approved</option>
                <option value="implemented">Implemented</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Acceptance Criteria (one per line)
            </label>
            <textarea
              value={formData.acceptance_criteria}
              onChange={(e) => setFormData({ ...formData, acceptance_criteria: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4699DF] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Enter each acceptance criteria on a new line..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 font-medium text-white shadow-sm hover:opacity-95"
            >
              {editingStory ? 'Update Story' : 'Create Story'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function UserStoryPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user, isAuthenticated } = useAuth();

  const [userStories, setUserStories] = useState<LocalUserStory[]>([]);
  const [groupedStories, setGroupedStories] = useState<Record<string, LocalUserStory[]>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [project, setProject] = useState<LocalProject | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<LocalUserStory | null>(null);

  const userStoryService = UserStoryService.getInstance();

  useEffect(() => {
    console.log('UserStoryPage initialized with projectId:', projectId);
    console.log('Authentication status:', isAuthenticated);
    console.log('User:', user);
    
    if (projectId) {
      loadProjectData();
      checkAndGenerateStories();
    } else {
      setError('Project ID is required');
      setLoading(false);
    }
  }, [projectId, isAuthenticated]);

  const handleGenerateStories = async () => {
    if (!projectId) {
      setError('Project ID is required');
      return;
    }

    setGenerating(true);
    setLoading(true);
    setError(null);
    setSuccess(null);

    const progressInterval = simulateProgress();

    try {
      const project = localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found in localStorage');
      }

      console.log('🔄 Generating stories for project:', project.title);
      
      // Use the unified method that handles both online/offline
      const result = await userStoryService.generateUserStories(projectId, project);
      
      if (result.success) {
        const successMsg = `Successfully generated ${result.count || 0} user stories!`;
        console.log(successMsg);
        setSuccess(successMsg);
        
        setProgress(100);
        setTimeout(() => {
          loadUserStories();
          setGenerating(false);
          setLoading(false);
        }, 500);
      } else {
        throw new Error(result.error || 'Generation failed');
      }

    } catch (err) {
      console.error('Generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(`Failed to generate user stories: ${errorMessage}`);
      
      setGenerating(false);
      setLoading(false);
    } finally {
      clearInterval(progressInterval);
    }
  };

  const loadProjectData = () => {
    if (!projectId) {
      setError('Project ID is required');
      return;
    }

    const projectData = localStorageService.getProject(projectId);
    console.log('Project data from localStorage:', projectData);

    if (projectData) {
      setError(null);
      setProject(projectData);
    } else {
      setError('Project not found');
    }
  };

  const checkAndGenerateStories = async () => {
    if (!projectId) {
      setError('Project ID is required');
      setLoading(false);
      return;
    }

    setError(null);

    const projectData = localStorageService.getProject(projectId);
    if (!projectData) {
      setError('Project not found');
      setLoading(false);
      return;
    }

    setProject(projectData);

    const existingStories = localStorageService.getUserStoriesByProject(projectId);
    console.log(`Found ${existingStories.length} existing stories for project ${projectId}`);

    if (existingStories.length === 0) {
      console.log('No existing stories found, auto-generating...');
      await handleGenerateStories();
    } else {
      console.log('Loading existing stories...');
      setUserStories(existingStories);
      groupStoriesByRole(existingStories);
      setLastUpdated(new Date().toLocaleString());
      setLoading(false);
    }
  };

  const loadUserStories = () => {
    if (!projectId) return;

    try {
      setError(null);
      const stories = localStorageService.getUserStoriesByProject(projectId);
      console.log('Loaded user stories:', stories);
      setUserStories(stories);
      groupStoriesByRole(stories);
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error('Error loading user stories:', error);
      setError('Failed to load user stories.');
    }
  };

  const groupStoriesByRole = (stories: LocalUserStory[]) => {
    const grouped: Record<string, LocalUserStory[]> = {};

    stories.forEach(story => {
      if (!grouped[story.role]) {
        grouped[story.role] = [];
      }
      grouped[story.role].push(story);
    });

    setGroupedStories(grouped);
  };

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 300);
    return interval;
  };

  const handleAccept = () => {
  if (projectId) {
    // Pass projectId as route parameter
    navigate(`/wireframe-generated/${projectId}`);
  } else {
    // Fallback if no projectId (shouldn't happen normally)
    navigate('/wireframe-generated');
  }
};

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4699DF] mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {generating
                ? (isAuthenticated ? 'Generating user stories with AI...' : 'Generating user stories locally...')
                : 'Loading user stories...'
              }
            </p>

            {generating && (
              <div className="mt-4 w-64 mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Generating...
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-[#5561AA] to-[#4699DF] h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold md:text-5xl">User Stories</h1>
            {project && (
              <p className="text-xl text-gray-600 mt-2">{project.title}</p>
            )}
            {projectId && (
              <div className="mt-2 space-y-1">
                <p className="text-gray-600">
                  {userStories.length} stories for this project
                </p>
                {lastUpdated && (
                  <p className="text-sm text-gray-500">
                    Last updated: {lastUpdated}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* REMOVED: Refresh, Create Story, and Regenerate buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-4 py-2 font-medium text-white shadow-sm hover:opacity-95"
            >
              Continue
            </button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="mb-6 space-y-3">
          {/* Authentication Status */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isAuthenticated
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${isAuthenticated ? 'bg-green-500' : 'bg-blue-500'
              }`}></span>
            {isAuthenticated ? `Online Mode (${user?.username})` : 'Offline Mode (Local)'}
          </div>

          {/* Progress Bar */}
          {generating && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Generating user stories...
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                <div
                  className="bg-gradient-to-r from-[#5561AA] to-[#4699DF] h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {success}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stories Content */}
        {userStories.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No user stories found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isAuthenticated
                ? "Get started by generating user stories for your project."
                : "Get started by generating user stories locally."
              }
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleAccept}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#4699DF] hover:bg-[#3a7bbf] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4699DF]"
              >
                Continue to Next Page
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedStories).map(([role, stories]) => (
              <section key={role} className="mb-8">
                <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white capitalize border-b pb-2">
                  {role}s ({stories.length} stories)
                </h2>
                <div className="space-y-4">
                  {stories.map((story) => (
                    <div
                      key={story.story_id}
                      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex-1 mr-4">
                          {story.story_text}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-1 text-xs rounded-full ${story.priority === 'high'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : story.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                            {story.priority}
                          </span>
                          {story.generated_by_llm && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full dark:bg-purple-900 dark:text-purple-200">
                              AI
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <div>
                          <strong>Feature:</strong> {story.feature || 'Not specified'}
                        </div>
                        <div>
                          <strong>Story Points:</strong> {story.story_points}
                        </div>
                        <div>
                          <strong>Status:</strong>
                          <span className={`ml-1 capitalize ${story.status === 'approved' ? 'text-green-600' :
                            story.status === 'implemented' ? 'text-blue-600' : 'text-yellow-600'
                            }`}>
                            {story.status}
                          </span>
                        </div>
                        <div>
                          <strong>Source:</strong>
                          <span className="ml-1">
                            {story.generated_by_llm ? 'AI Generated' : 'Manual'}
                          </span>
                        </div>
                      </div>

                      {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                            Acceptance Criteria:
                          </h4>
                          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                            {story.acceptance_criteria.map((criterion, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-green-500 mr-2 mt-1">•</span>
                                <span>{criterion}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Created: {new Date(story.created_at).toLocaleDateString()}
                          {story.updated_at !== story.created_at &&
                            ` • Updated: ${new Date(story.updated_at).toLocaleDateString()}`
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Continue Button at Bottom */}
        {userStories.length > 0 && (
          <div className="flex justify-center mt-8">
            <button
              onClick={handleAccept}
              className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-8 py-3 font-medium text-white shadow-sm hover:opacity-95 text-lg"
            >
              Continue to Wireframes
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}