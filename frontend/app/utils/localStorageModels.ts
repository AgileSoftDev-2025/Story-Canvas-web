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

// In localStorageModels.ts
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