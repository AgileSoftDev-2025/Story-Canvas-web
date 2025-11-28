// frontend/src/utils/localStorageModels.ts
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface LocalUser extends BaseEntity {
  username: string;
  email: string;
  password?: string;
  is_active: boolean;
  last_login: string;
}

export interface LocalProject {
  project_id: string;
  user_id: string;
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
  status: 'draft' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  // Optional fields
  is_guest_project?: boolean;
  user_specific?: boolean;
}

export interface LocalUserStory {
  story_id: string;
  project_id: string;
  
  story_text: string;
  role: string;
  action: string;
  benefit: string;
  feature: string;
  
  acceptance_criteria: any[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  story_points: number;
  status: 'draft' | 'reviewed' | 'approved' | 'implemented';
  
  generated_by_llm: boolean;
  iteration: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface LocalWireframe {
  wireframe_id: string;
  project_id: string;
  
  page_name: string;
  page_type: 'login' | 'dashboard' | 'profile' | 'products' | 'cart' | 'checkout' | 'search' | 'admin' | 'general';
  description: string;
  
  html_content: string;
  creole_content: string;
  salt_diagram: string;
  
  generated_with_rag: boolean;
  wireframe_type: 'desktop' | 'mobile' | 'tablet';
  version: number;
  
  preview_url: string;
  
  // NEW FIELDS - Added for wireframe generation
  stories_count: number;
  features_count: number;
  generated_at: string;
  is_local?: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface LocalScenario {
  scenario_id: string;
  project_id: string;
  user_story_id: string | null;
  
  scenario_text: string;
  scenario_type: 'happy_path' | 'alternate_path' | 'exception_path' | 'boundary_case';
  title: string;
  
  detected_domain: string;
  has_proper_structure: boolean;
  
  gherkin_steps: any[];
  
  enhanced_with_llm: boolean;
  status: 'draft' | 'reviewed' | 'approved' | 'tested';
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Additional interfaces for session and history tracking
export interface LocalSession {
  session_id: string;
  project_id: string;
  project_title: string;
  wireframes_generated: number;
  generated_at: string;
  is_local?: boolean;
}

export interface LocalHistory {
  history_id: string;
  session_id: string;
  action_type: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Interface for API responses to match the expected format
export interface WireframeGenerationResponse {
  success: boolean;
  message: string;
  wireframes: LocalWireframe[];
  session?: LocalSession;
  count: number;
}

export interface UserStoryGenerationResponse {
  success: boolean;
  message: string;
  stories: LocalUserStory[];
  count: number;
}

// Interface for project data sent to local APIs
export interface LocalProjectData {
  title: string;
  objective: string;
  users: string[];
  features: string[];
  scope: string;
  flow: string;
  additional_info: string;
  domain: string;
}

// Interface for wireframe data from local APIs
export interface LocalWireframeData {
  wireframe_id: string;
  project_id: string;
  page_name: string;
  html_content: string;
  creole_documentation: string;
  salt_uml: string;
  features_count: number;
  stories_count: number;
  generated_at: string;
  is_local: boolean;
}

// Interface for service responses
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Type guards for runtime type checking
export const isLocalProject = (obj: any): obj is LocalProject => {
  return obj && 
    typeof obj.project_id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.objective === 'string';
};

export const isLocalUserStory = (obj: any): obj is LocalUserStory => {
  return obj && 
    typeof obj.story_id === 'string' &&
    typeof obj.story_text === 'string' &&
    typeof obj.role === 'string';
};

export const isLocalWireframe = (obj: any): obj is LocalWireframe => {
  return obj && 
    typeof obj.wireframe_id === 'string' &&
    typeof obj.page_name === 'string' &&
    typeof obj.html_content === 'string';
};

export const isLocalScenario = (obj: any): obj is LocalScenario => {
  return obj && 
    typeof obj.scenario_id === 'string' &&
    typeof obj.scenario_text === 'string' &&
    typeof obj.scenario_type === 'string';
};

// Utility types for creation (without auto-generated fields)
export type CreateLocalProject = Omit<LocalProject, 'project_id' | 'created_at' | 'updated_at'>;
export type CreateLocalUserStory = Omit<LocalUserStory, 'story_id' | 'created_at' | 'updated_at'>;
export type CreateLocalWireframe = Omit<LocalWireframe, 'wireframe_id' | 'created_at' | 'updated_at'>;
export type CreateLocalScenario = Omit<LocalScenario, 'scenario_id' | 'created_at' | 'updated_at'>;