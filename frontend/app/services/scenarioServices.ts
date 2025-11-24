// frontend/services/scenarioServices.ts

const API_BASE = 'http://127.0.0.1:8000';

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Utility functions for case conversion
const caseUtils = {
  // Convert camelCase to snake_case
  toSnakeCase: (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => caseUtils.toSnakeCase(item));
    }
    
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      acc[snakeKey] = caseUtils.toSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  },

  // Convert snake_case to camelCase
  toCamelCase: (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => caseUtils.toCamelCase(item));
    }
    
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = caseUtils.toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  },

  // Normalize API response to camelCase
  normalizeResponse: <T>(response: any): T => {
    return caseUtils.toCamelCase(response) as T;
  },

  // Prepare request data to snake_case
  prepareRequest: (data: any): any => {
    return caseUtils.toSnakeCase(data);
  }
};

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

export const scenarioService = {
  async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(`HTTP ${response.status}: ${errorText}`, response.status);
    }
    const data = await response.json();
    return caseUtils.normalizeResponse<T>(data);
  },

  // === PROJECT-BASED SCENARIOS ===

 async getProjectScenarios(projectId: string): Promise<ProjectScenarioResponse> {
  try {
    console.log(`📡 [FRONTEND] Fetching scenarios for project: ${projectId}`);
    
    const url = `${API_BASE}/api/projects/${projectId}/scenarios/`;
    console.log(`📡 [FRONTEND] Full URL: ${url}`);
    
    const response = await fetch(url);
    console.log(`📡 [FRONTEND] Response status: ${response.status}`);
    console.log(`📡 [FRONTEND] Response ok: ${response.ok}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ [FRONTEND] HTTP Error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const rawResult = await response.json();
    console.log("✅ [FRONTEND] Raw API Response:", rawResult);
    
    // Handle different response structures
    if (rawResult.success) {
      // Structure 1: Direct scenarios in response
      if (rawResult.scenarios && Array.isArray(rawResult.scenarios)) {
        console.log(`✅ [FRONTEND] Using direct scenarios structure, count: ${rawResult.scenarios.length}`);
        return {
          success: true,
          scenarios: rawResult.scenarios,
          project_title: rawResult.project_title || "Project Scenarios",
          project_id: projectId,
          count: rawResult.count || rawResult.scenarios.length
        };
      }
      
      // Structure 2: Nested in data object
      if (rawResult.data && rawResult.data.scenarios) {
        console.log(`✅ [FRONTEND] Using nested data structure, count: ${rawResult.data.scenarios.length}`);
        return {
          success: true,
          scenarios: rawResult.data.scenarios,
          project_title: rawResult.data.project_title || rawResult.data.title || "Project Scenarios",
          project_id: projectId,
          count: rawResult.data.count || rawResult.data.scenarios.length
        };
      }
      
      // Structure 3: No scenarios found
      console.log("ℹ️ [FRONTEND] No scenarios found in response");
      return {
        success: true,
        scenarios: [],
        project_title: rawResult.project_title || "Project Scenarios",
        project_id: projectId,
        count: 0
      };
    } else {
      console.log(`❌ [FRONTEND] API Error: ${rawResult.error}`);
      return {
        success: false,
        scenarios: [],
        project_title: "Project Scenarios",
        project_id: projectId,
        count: 0,
        error: rawResult.error || 'Failed to load scenarios'
      };
    }
  } catch (error) {
    console.error('❌ [FRONTEND] Error in getProjectScenarios:', error);
    return {
      success: false,
      scenarios: [],
      project_title: "Project Scenarios",
      project_id: projectId,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
},

  async generateProjectScenarios(projectId: string, options: any = {}): Promise<GenerateProjectScenarioResponse> {
    try {
      console.log(`🤖 [FRONTEND] Generating scenarios for project: ${projectId}`);
      
      // 🔴 PERBAIKAN: TAMBAHKAN /api/
      const url = `${API_BASE}/api/projects/${projectId}/generate-scenarios/`;
      console.log(`🤖 [FRONTEND] Full URL: ${url}`);
      
      const response = await fetch(url, {
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
      
      console.log(`🤖 [FRONTEND] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ [FRONTEND] HTTP Error: ${response.status} - ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const rawResult = await response.json();
      console.log("✅ [FRONTEND] Generate Response:", rawResult);
      
      const result = caseUtils.normalizeResponse<any>(rawResult);
      
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
      console.error('❌ [FRONTEND] Error generating project scenarios:', error);
      throw error;
    }
  },

  async acceptProjectScenarios(projectId: string, scenarioIds: string[] = []): Promise<AcceptProjectScenarioResponse> {
    try {
      console.log(`✅ [FRONTEND] Accepting scenarios for project: ${projectId}`, scenarioIds);
      
      // 🔴 PERBAIKAN: TAMBAHKAN /api/
      const url = `${API_BASE}/api/projects/${projectId}/accept-scenarios/`;
      console.log(`✅ [FRONTEND] Full URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseUtils.prepareRequest({ 
          scenario_ids: scenarioIds 
        })),
      });
      
      console.log(`✅ [FRONTEND] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ [FRONTEND] HTTP Error: ${response.status} - ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const rawResult = await response.json();
      console.log("✅ [FRONTEND] Accept Response:", rawResult);
      
      const result = caseUtils.normalizeResponse<any>(rawResult);
      
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
      console.error('❌ [FRONTEND] Error accepting project scenarios:', error);
      throw error;
    }
  },

  // === STORY-BASED SCENARIOS ===

  async getStoryScenarios(storyId: string): Promise<ScenarioResponse> {
    try {
      console.log(`📡 [FRONTEND] Fetching scenarios for story: ${storyId}`);
      
      const url = `${API_BASE}/api/user-stories/${storyId}/scenarios/`;
      const response = await fetch(url);
      
      return await this.handleResponse<ScenarioResponse>(response);
    } catch (error) {
      console.error('❌ [FRONTEND] Error fetching scenarios:', error);
      throw error;
    }
  },

  async generateScenarios(storyId: string, options: any = {}): Promise<GenerateScenarioResponse> {
    try {
      console.log(`🤖 [FRONTEND] Generating scenarios for story: ${storyId}`);
      
      const url = `${API_BASE}/api/user-stories/${storyId}/generate-scenarios/`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseUtils.prepareRequest(options)),
      });
      
      return await this.handleResponse<GenerateScenarioResponse>(response);
    } catch (error) {
      console.error('❌ [FRONTEND] Error generating scenarios:', error);
      throw error;
    }
  },

  async acceptScenarios(storyId: string, scenarioIds: string[] = []): Promise<AcceptScenarioResponse> {
    try {
      console.log(`✅ [FRONTEND] Accepting scenarios for story: ${storyId}`, scenarioIds);
      
      const url = `${API_BASE}/api/user-stories/${storyId}/accept-scenarios/`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseUtils.prepareRequest({ scenario_ids: scenarioIds })),
      });
      
      return await this.handleResponse<AcceptScenarioResponse>(response);
    } catch (error) {
      console.error('❌ [FRONTEND] Error accepting scenarios:', error);
      throw error;
    }
  }
};