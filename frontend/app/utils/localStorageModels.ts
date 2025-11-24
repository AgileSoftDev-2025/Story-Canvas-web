// frontend/src/utils/localStorageModels.ts

// Base interface dengan UUID pendek
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// User Model (sesuai dengan CustomUser di Django)
export interface LocalUser extends BaseEntity {
  username: string;
  email: string;
  password?: string;
  is_active: boolean;
  last_login: string;
}

// Project Model (sesuai dengan Project di Django)
export interface LocalProject {
  project_id: string;
  user_id: string;
  
  // Core project info
  title: string;
  objective: string;
  scope: string;
  flow: string;
  additional_info: string;
  
  // Analysis data
  domain: string;
  language: string;
  nlp_analysis: Record<string, any>;
  
  // JSON data storage
  users_data: any[];
  features_data: any[];
  
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// User Story Model (sesuai dengan UserStory di Django)
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

// Wireframe Model (sesuai dengan Wireframe di Django)
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
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Scenario Model (sesuai dengan Scenario di Django)
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

// Generation Session Model
export interface LocalGenerationSession {
  session_id: string;
  project_id: string;
  user_id: string;
  
  llm_model_used: string;
  
  user_stories_generated: number;
  wireframes_generated: number;
  scenarios_generated: number;
  total_iterations: number;
  
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  
  status: 'running' | 'completed' | 'failed';
  error_message: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Project History Model dengan field optional
export interface LocalProjectHistory {
  history_id: string;
  project_id: string;
  user_id: string;
  generation_session_id: string | null;
  
  action_type: 'project_created' | 'project_updated' | 'stories_generated' | 'wireframes_generated' | 'scenarios_generated' | 'export_created' | 'review_iteration';
  action_details: Record<string, any>;
  description: string;
  
  related_story_id: string | null;
  related_wireframe_id: string | null;
  related_scenario_id: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Type untuk membuat project history (field optional benar-benar optional)
export type CreateProjectHistoryData = {
  project_id: string;
  user_id: string;
  action_type: LocalProjectHistory['action_type'];
  action_details: Record<string, any>;
  description: string;
  generation_session_id?: string | null;
  related_story_id?: string | null;
  related_wireframe_id?: string | null;
  related_scenario_id?: string | null;
};

// Export Model
export interface LocalExport {
  export_id: string;
  project_id: string;
  user_id: string;
  generation_session_id: string | null;
  
  export_format: 'html' | 'pdf' | 'word' | 'json' | 'zip';
  file_path: string | null;
  file_url: string | null;
  file_size: number;
  
  include_stories: boolean;
  include_wireframes: boolean;
  include_scenarios: boolean;
  export_config: Record<string, any>;
  
  status: string;
  error_message: string | null;
  
  exported_at: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}