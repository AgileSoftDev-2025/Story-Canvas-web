// app/services/scenarioServices.ts

const API_BASE = 'http://127.0.0.1:8000';

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface Scenario {
  scenario_id: string;
  user_story?: string;
  user_story_title?: string;
  scenario_text: string;
  scenario_type: string;
  title: string;
  detected_domain: string;
  has_proper_structure: boolean;
  gherkin_steps: string[];
  enhanced_with_llm: boolean;
  status: 'draft' | 'accepted' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface ScenarioResponse {
  success: boolean;
  scenarios: Scenario[];
  story_title?: string;
  project_title?: string;
  story_id?: string;
  project_id?: string;
  count: number;
  error?: string;
}

export interface GenerateScenarioResponse {
  success: boolean;
  message: string;
  generated_scenarios: Scenario[];
  story_id?: string;
  project_id?: string;
  count: number;
  error?: string;
}

export interface AcceptScenarioResponse {
  success: boolean;
  message: string;
  story_id?: string;
  project_id?: string;
  accepted_count: number;
  accepted_scenarios?: Scenario[];
  error?: string;
}

export interface ProjectScenarioResponse {
  success: boolean;
  data?: {
    scenarios: Scenario[];
    project_title: string;
    project_id: string;
    count: number;
  };
  scenarios?: Scenario[];
  project_title?: string;
  project_id?: string;
  count?: number;
  error?: string;
}

export interface GenerateProjectScenarioResponse {
  success: boolean;
  data?: {
    generated_scenarios: Scenario[];
    project_id: string;
    count: number;
  };
  message: string;
  generated_scenarios?: Scenario[];
  project_id?: string;
  count?: number;
  error?: string;
}

export interface AcceptProjectScenarioResponse {
  success: boolean;
  data?: {
    accepted_count: number;
    accepted_scenarios?: Scenario[];
    project_id: string;
  };
  message: string;
  accepted_count?: number;
  accepted_scenarios?: Scenario[];
  project_id?: string;
  error?: string;
}

// Utility functions for case conversion
const caseUtils = {
  // Convert camelCase to snake_case
  toSnakeCase(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.toSnakeCase(item));
    }
    
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      acc[snakeKey] = this.toSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  },

  // Convert snake_case to camelCase
  toCamelCase(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.toCamelCase(item));
    }
    
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = this.toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  },

  // Normalize API response to camelCase
  normalizeResponse<T>(response: any): T {
    return this.toCamelCase(response) as T;
  },

  // Prepare request data to snake_case
  prepareRequest(data: any): any {
    return this.toSnakeCase(data);
  }
};

export const scenarioService = {
  async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(`HTTP ${response.status}: ${errorText}`, response.status);
    }
    const data = await response.json();
    return caseUtils.normalizeResponse<T>(data);
  },

  // === STORY-BASED SCENARIOS ===

  async getStoryScenarios(storyId: string): Promise<ScenarioResponse> {
    try {
      console.log(`📡 Fetching scenarios for story: ${storyId}`);
      const response = await fetch(`${API_BASE}/user-stories/${storyId}/scenarios/`);
      return await this.handleResponse<ScenarioResponse>(response);
    } catch (error) {
      console.error('❌ Error fetching scenarios:', error);
      throw error;
    }
  },

  async generateScenarios(storyId: string, options: any = {}): Promise<GenerateScenarioResponse> {
    try {
      console.log(`🤖 Generating scenarios for story: ${storyId}`);
      const response = await fetch(`${API_BASE}/user-stories/${storyId}/generate-scenarios/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseUtils.prepareRequest(options)),
      });
      return await this.handleResponse<GenerateScenarioResponse>(response);
    } catch (error) {
      console.error('❌ Error generating scenarios:', error);
      throw error;
    }
  },

  async acceptScenarios(storyId: string, scenarioIds: string[] = []): Promise<AcceptScenarioResponse> {
    try {
      console.log(`✅ Accepting scenarios for story: ${storyId}`, scenarioIds);
      const response = await fetch(`${API_BASE}/user-stories/${storyId}/accept-scenarios/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseUtils.prepareRequest({ scenario_ids: scenarioIds })),
      });
      return await this.handleResponse<AcceptScenarioResponse>(response);
    } catch (error) {
      console.error('❌ Error accepting scenarios:', error);
      throw error;
    }
  },

  // === PROJECT-BASED SCENARIOS ===

  async getProjectScenarios(projectId: string): Promise<ProjectScenarioResponse> {
    try {
      console.log(`📡 Fetching scenarios for project: ${projectId}`);
      
      const response = await fetch(`${API_BASE}/projects/${projectId}/scenarios/`);
      const result = await this.handleResponse<any>(response);
      
      console.log("🔍 [DEBUG] Raw API Response:", result);
      
      // Handle nested data structure dari backend
      if (result.success && result.data) {
        return {
          success: true,
          scenarios: result.data.scenarios || [],
          project_title: result.data.project_title,
          project_id: result.data.project_id,
          count: result.data.count || 0
        };
      }
      
      // Fallback untuk struktur langsung
      return result;
    } catch (error) {
      console.error('❌ Error fetching project scenarios:', error);
      throw error;
    }
  },

  async generateProjectScenarios(projectId: string, options: any = {}): Promise<GenerateProjectScenarioResponse> {
    try {
      console.log(`🤖 Generating scenarios for project: ${projectId}`);
      
      const response = await fetch(`${API_BASE}/projects/${projectId}/generate-scenarios/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseUtils.prepareRequest({
          force_regenerate: true,
          overwrite_existing: true,
          ...options
        })),
      });
      
      const result = await this.handleResponse<any>(response);
      console.log("🔍 [DEBUG] Generate Response:", result);
      
      // Handle nested data structure
      if (result.success && result.data) {
        return {
          success: true,
          message: result.message || 'Scenarios generated successfully',
          generated_scenarios: result.data.generated_scenarios || [],
          project_id: result.data.project_id,
          count: result.data.count || 0
        };
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error generating project scenarios:', error);
      throw error;
    }
  },

  async acceptProjectScenarios(projectId: string, scenarioIds: string[] = []): Promise<AcceptProjectScenarioResponse> {
    try {
      console.log(`✅ Accepting scenarios for project: ${projectId}`, scenarioIds);
      
      const response = await fetch(`${API_BASE}/projects/${projectId}/accept-scenarios/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseUtils.prepareRequest({ 
          scenario_ids: scenarioIds 
        })),
      });
      
      const result = await this.handleResponse<any>(response);
      console.log("🔍 [DEBUG] Accept Response:", result);
      
      // Handle nested data structure
      if (result.success && result.data) {
        return {
          success: true,
          message: result.message || 'Scenarios accepted successfully',
          accepted_count: result.data.accepted_count || 0,
          accepted_scenarios: result.data.accepted_scenarios || [],
          project_id: result.data.project_id
        };
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error accepting project scenarios:', error);
      throw error;
    }
  },

  // === UNIVERSAL METHODS ===

  async getScenarios(resourceId: string, type: 'story' | 'project' = 'project'): Promise<ScenarioResponse | ProjectScenarioResponse> {
    try {
      if (type === 'story') {
        return await this.getStoryScenarios(resourceId);
      } else {
        return await this.getProjectScenarios(resourceId);
      }
    } catch (error) {
      console.error(`❌ Error fetching ${type} scenarios:`, error);
      throw error;
    }
  },

  async generateNewScenarios(resourceId: string, type: 'story' | 'project' = 'project', options: any = {}): Promise<GenerateScenarioResponse | GenerateProjectScenarioResponse> {
    try {
      if (type === 'story') {
        return await this.generateScenarios(resourceId, options);
      } else {
        return await this.generateProjectScenarios(resourceId, options);
      }
    } catch (error) {
      console.error(`❌ Error generating ${type} scenarios:`, error);
      throw error;
    }
  },

  async acceptAllScenarios(resourceId: string, type: 'story' | 'project' = 'project', scenarioIds: string[] = []): Promise<AcceptScenarioResponse | AcceptProjectScenarioResponse> {
    try {
      if (type === 'story') {
        return await this.acceptScenarios(resourceId, scenarioIds);
      } else {
        return await this.acceptProjectScenarios(resourceId, scenarioIds);
      }
    } catch (error) {
      console.error(`❌ Error accepting ${type} scenarios:`, error);
      throw error;
    }
  },

  // === UTILITY METHODS ===

  async checkScenariosExist(resourceId: string, type: 'story' | 'project' = 'project'): Promise<boolean> {
    try {
      const result = await this.getScenarios(resourceId, type);
      return result.success && ((result.scenarios?.length ?? 0) > 0);
    } catch (error) {
      console.error(`❌ Error checking ${type} scenarios:`, error);
      return false;
    }
  },

  async getScenarioStatistics(resourceId: string, type: 'story' | 'project' = 'project') {
    try {
      const result = await this.getScenarios(resourceId, type);
      if (!result.success) {
        return null;
      }

      // PERBAIKAN: Gunakan nullish coalescing untuk handle undefined scenarios
      const scenarios = result.scenarios ?? [];
      
      return {
        total: scenarios.length,
        byType: {
          main_success: scenarios.filter(s => s.scenario_type === 'main_success').length,
          alternative: scenarios.filter(s => s.scenario_type === 'alternative').length,
          edge_case: scenarios.filter(s => s.scenario_type === 'edge_case').length,
          other: scenarios.filter(s => !['main_success', 'alternative', 'edge_case'].includes(s.scenario_type)).length
        },
        byStatus: {
          draft: scenarios.filter(s => s.status === 'draft').length,
          accepted: scenarios.filter(s => s.status === 'accepted').length,
          rejected: scenarios.filter(s => s.status === 'rejected').length
        },
        withProperStructure: scenarios.filter(s => s.has_proper_structure).length,
        enhancedWithLLM: scenarios.filter(s => s.enhanced_with_llm).length
      };
    } catch (error) {
      console.error(`❌ Error getting ${type} scenario statistics:`, error);
      return null;
    }
  }
};