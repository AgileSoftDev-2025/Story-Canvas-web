import { localStorageService } from "../utils/localStorageService";
import type { LocalProject, LocalUserStory, LocalWireframe, CreateLocalWireframe } from "../utils/localStorageModels";

class WireframeService {
  private static instance: WireframeService;

  public static getInstance(): WireframeService {
    if (!WireframeService.instance) {
      WireframeService.instance = new WireframeService();
    }
    return WireframeService.instance;
  }

  // ===== NEW METHODS =====
  
  // Get wireframes with enhanced display data for the UI
  async getWireframesForDisplay(projectId: string): Promise<any[]> {
    try {
      const wireframes = localStorageService.getWireframesByProject(projectId);
      
      return wireframes.map(wireframe => this.enhanceWireframeWithDisplayData(wireframe));
    } catch (error) {
      console.error('Error getting wireframes for display:', error);
      return [];
    }
  }

  // Get detailed wireframe information including full LLM response
  async getWireframeDetails(wireframeId: string): Promise<any> {
    try {
      // Get all wireframes and find the specific one
      const allWireframes = localStorageService.getAllWireframes();
      const wireframe = allWireframes.find(wf => wf.wireframe_id === wireframeId);
      
      if (!wireframe) {
        throw new Error(`Wireframe with ID ${wireframeId} not found`);
      }

      return this.enhanceWireframeWithDisplayData(wireframe, true);
    } catch (error) {
      console.error('Error getting wireframe details:', error);
      throw error;
    }
  }

  // Enhance wireframe with display and debug information
  private enhanceWireframeWithDisplayData(wireframe: LocalWireframe, includeFullResponse: boolean = false): any {
    const htmlContent = wireframe.html_content || '';
    const hasValidStructure = this.validateHTMLStructure(htmlContent);
    
    // Analyze LLM response patterns
    const llmResponsePreview = this.extractLLMResponsePreview(wireframe);
    const usedRag = wireframe.generated_with_rag || false;
    const usedFallback = !usedRag && wireframe.is_local;
    
    // Calculate metrics
    const uiPatternsUsed = this.countUIPatterns(htmlContent);
    const projectPatternsUsed = this.countProjectPatterns(wireframe);
    
    const enhancedWireframe = {
      ...wireframe,
      display_data: {
        page_name: wireframe.page_name,
        page_type: wireframe.page_type,
        html_preview: this.generateHTMLPreview(htmlContent),
        has_valid_structure: hasValidStructure,
        stories_count: wireframe.stories_count || 0,
        features_count: wireframe.features_count || 0,
        generated_at: wireframe.generated_at || wireframe.created_at,
        debug_status: hasValidStructure ? 'success' : 'invalid_html',
        llm_response_preview: llmResponsePreview,
        llm_response_length: llmResponsePreview.length,
        html_length: htmlContent.length,
        used_rag: usedRag,
        used_fallback: usedFallback,
        generation_error: this.extractGenerationError(wireframe),
        ui_patterns_used: uiPatternsUsed,
        project_patterns_used: projectPatternsUsed
      }
    };
    return enhancedWireframe;
  }

  // ===== HELPER METHODS FOR DISPLAY DATA =====

  private validateHTMLStructure(htmlContent: string): boolean {
    if (!htmlContent || htmlContent.trim().length === 0) return false;
    
    // Basic HTML structure validation
    const hasHTMLTag = htmlContent.includes('<html') || htmlContent.includes('<!DOCTYPE');
    const hasBodyTag = htmlContent.includes('<body');
    const hasHeadTag = htmlContent.includes('<head');
    
    // For simpler wireframes, we might not require full HTML structure
    if (!hasHTMLTag && !hasBodyTag) {
      // Check if it has at least some HTML elements
      const hasAnyHTMLElements = /<[a-z][\s\S]*>/i.test(htmlContent);
      return hasAnyHTMLElements;
    }
    
    return hasHTMLTag || (hasBodyTag && hasHeadTag);
  }

  private extractLLMResponsePreview(wireframe: LocalWireframe): string {
    // Try to extract from creole content first (often contains LLM reasoning)
    if (wireframe.creole_content && wireframe.creole_content.length > 0) {
      return wireframe.creole_content.substring(0, 200) + '...';
    }
    
    // Fall back to salt diagram or description
    if (wireframe.salt_diagram && wireframe.salt_diagram.length > 0) {
      return `Salt UML: ${wireframe.salt_diagram.substring(0, 150)}...`;
    }
    
    if (wireframe.description && wireframe.description.length > 0) {
      return `Description: ${wireframe.description.substring(0, 150)}...`;
    }
    
    return 'No LLM response data available';
  }

  private extractFullLLMResponse(wireframe: LocalWireframe): string {
    // Combine all available content that might contain LLM reasoning
    const parts = [];
    
    if (wireframe.creole_content) {
      parts.push(`=== Creole Documentation ===\n${wireframe.creole_content}`);
    }
    
    if (wireframe.salt_diagram) {
      parts.push(`=== Salt UML Diagram ===\n${wireframe.salt_diagram}`);
    }
    
    if (wireframe.description) {
      parts.push(`=== Description ===\n${wireframe.description}`);
    }
    
    return parts.join('\n\n') || 'No detailed LLM response data available';
  }

  private extractGenerationError(wireframe: LocalWireframe): string | undefined {
    // Check for error patterns in the content
    const html = wireframe.html_content || '';
    
    if (html.includes('error') || html.includes('Exception') || html.includes('Failed')) {
      // Extract error context
      const errorMatch = html.match(/(error|exception|failed)[^<]*/i);
      return errorMatch ? errorMatch[0] : 'Generation error detected in output';
    }
    
    return undefined;
  }

  private generateHTMLPreview(htmlContent: string): string {
    if (!htmlContent) return 'No HTML content';
    
    // Remove HTML tags and get clean text preview
    const textOnly = htmlContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textOnly.substring(0, 100) + (textOnly.length > 100 ? '...' : '');
  }

  private countUIPatterns(htmlContent: string): number {
    if (!htmlContent) return 0;
    
    const patterns = [
      /<form[^>]*>/gi,
      /<input[^>]*>/gi,
      /<button[^>]*>/gi,
      /<nav[^>]*>/gi,
      /<table[^>]*>/gi,
      /<div class="[^"]*container[^"]*"/gi,
      /<div class="[^"]*card[^"]*"/gi,
      /<div class="[^"]*modal[^"]*"/gi
    ];
    
    return patterns.reduce((count, pattern) => {
      const matches = htmlContent.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private countProjectPatterns(wireframe: LocalWireframe): number {
    let count = 0;
    
    // Count based on wireframe properties
    if (wireframe.stories_count && wireframe.stories_count > 0) count++;
    if (wireframe.features_count && wireframe.features_count > 0) count++;
    if (wireframe.generated_with_rag) count++;
    if (wireframe.creole_content && wireframe.creole_content.length > 10) count++;
    if (wireframe.salt_diagram && wireframe.salt_diagram.length > 10) count++;
    
    return count;
  }

  // ===== EXISTING METHODS (keep all your existing code below) =====
  
  // Unified method that handles both online and offline modes
  async generateWireframes(projectId: string, projectData?: LocalProject): Promise<any> {
    const isAuthenticated = !!localStorage.getItem('access_token');
    
    if (isAuthenticated) {
      console.log('🟢 ONLINE MODE: Using authenticated API for wireframes');
      return await this.generateWireframesOnline(projectId);
    } else {
      console.log('🟡 OFFLINE MODE: Using local project API for wireframes');
      return await this.generateWireframesOfflineAPI(projectId, projectData);
    }
  }

  // Generate wireframes via API (authenticated)
  async generateWireframesOnline(projectId: string): Promise<any> {
    try {
      console.log('Attempting to generate wireframes for project:', projectId);

      const token = localStorage.getItem('access_token');
      if (!token) {
        console.warn('No authentication token found, using offline mode');
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/projects/${projectId}/generate-wireframes/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Wireframe API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Wireframe API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('Wireframe API Response data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Wireframe generation failed on server');
      }

      // Save wireframes to localStorage for consistency
      if (data.wireframes && Array.isArray(data.wireframes)) {
        this.saveWireframesToLocalStorage(data.wireframes, projectId);
      }

      return data;
    } catch (error) {
      console.error('Error generating wireframes online:', error);
      throw error;
    }
  }

  // Generate wireframes via API for local projects (no auth required)
  async generateWireframesOfflineAPI(projectId: string, projectData?: LocalProject): Promise<any> {
    try {
      console.log('🔄 Generating wireframes for local project via API:', projectId);

      // Get project data from localStorage if not provided
      const project = projectData || localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found in localStorage');
      }

      // Get user stories for this project
      const userStories = localStorageService.getUserStoriesByProject(projectId);
      if (!userStories || userStories.length === 0) {
        throw new Error('No user stories found. Generate user stories first.');
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

      // Prepare user stories data
      const userStoriesData = userStories.map(story => ({
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
        generated_by_llm: story.generated_by_llm
      }));

      console.log('Sending data to local wireframe API:', {
        project: apiProjectData.title,
        stories_count: userStoriesData.length
      });

      // Call the local endpoint for wireframe generation
      const response = await fetch('/api/local-projects/generate-wireframes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          project_data: apiProjectData,
          user_stories: userStoriesData,
          project_id: projectId 
        })
      });

      console.log('Local Wireframe API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Local Wireframe API Error:', errorText);
        throw new Error(`Local API error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log('Local Wireframe API Response data:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Local wireframe generation failed on server');
      }

      // Save the generated wireframes to localStorage
      if (data.wireframes && Array.isArray(data.wireframes)) {
        this.saveWireframesToLocalStorage(data.wireframes, projectId);
        console.log(`✅ Saved ${data.wireframes.length} wireframes to localStorage`);
      }

      return data;
    } catch (error) {
      console.error('Error generating wireframes via local API:', error);
      
      console.log('🔄 Falling back to template-based wireframe generation');
      return this.generateWireframesOfflineFallback(projectId);
    }
  }

  // Fallback to template generation when API fails
  private async generateWireframesOfflineFallback(projectId: string): Promise<any> {
    try {
      const project = localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found in localStorage');
      }

      const userStories = localStorageService.getUserStoriesByProject(projectId);
      if (!userStories || userStories.length === 0) {
        throw new Error('No user stories found for fallback generation');
      }

      const wireframes = this.generateWireframesOffline(project, userStories);
      
      return {
        success: true,
        message: `Generated ${wireframes.length} wireframes using templates`,
        wireframes: wireframes,
        count: wireframes.length
      };
    } catch (error) {
      console.error('Template wireframe generation also failed:', error);
      throw error;
    }
  }

  // Generate wireframes offline (template-based)
  generateWireframesOffline(project: LocalProject, userStories: LocalUserStory[]): any[] {
    console.log('Generating wireframes offline for project:', project.title);

    // Group stories by role to create pages
    const storiesByRole: Record<string, LocalUserStory[]> = {};
    userStories.forEach(story => {
      if (!storiesByRole[story.role]) {
        storiesByRole[story.role] = [];
      }
      storiesByRole[story.role].push(story);
    });

    const wireframes = [];
    let wireframeId = 1;

    for (const [role, stories] of Object.entries(storiesByRole)) {
      const pageName = `${role.toLowerCase().replace(' ', '-')}-page`;
      const pageType = this.determinePageType(pageName);
      
      // Create basic HTML wireframe
      const htmlContent = this.createBasicWireframeHTML(project, role, stories);
      
      const wireframeData: CreateLocalWireframe = {
        project_id: project.project_id,
        page_name: pageName,
        page_type: pageType,
        description: `${role} interface for ${project.title}`,
        html_content: htmlContent,
        creole_content: this.generateCreoleDocumentation(project, role, stories),
        salt_diagram: this.generateSaltUML(project, role, stories),
        generated_with_rag: false,
        wireframe_type: 'desktop',
        version: 1,
        preview_url: '',
        stories_count: stories.length,
        features_count: new Set(stories.map(s => s.feature)).size,
        generated_at: new Date().toISOString(),
        is_local: true
      };

      // Create wireframe using localStorageService
      const createdWireframe = localStorageService.createWireframe(wireframeData);
      wireframes.push(createdWireframe);
      wireframeId++;
    }

    console.log(`Generated ${wireframes.length} wireframes offline`);
    return wireframes;
  }

  // Save wireframes to localStorage - FIXED to match LocalWireframe interface
  private saveWireframesToLocalStorage(apiWireframes: any[], projectId: string): void {
    try {
      console.log('💾 Saving wireframes to localStorage');
      
      // Clear existing wireframes for this project - FIXED: Use custom deletion
      const existingWireframes = localStorageService.getWireframesByProject(projectId);
      existingWireframes.forEach(wireframe => {
        this.deleteWireframeLocal(wireframe.wireframe_id);
      });

      // Save new wireframes with correct interface
      apiWireframes.forEach((apiWireframe: any) => {
        const wireframeData: CreateLocalWireframe = {
          project_id: projectId,
          page_name: apiWireframe.page_name || 'unnamed-page',
          page_type: this.determinePageType(apiWireframe.page_name),
          description: apiWireframe.description || `Wireframe for ${apiWireframe.page_name}`,
          html_content: apiWireframe.html_content || '',
          creole_content: apiWireframe.creole_documentation || apiWireframe.creole_content || '',
          salt_diagram: apiWireframe.salt_uml || apiWireframe.salt_diagram || '',
          generated_with_rag: apiWireframe.used_rag_patterns || false,
          wireframe_type: 'desktop', // default
          version: 1,
          preview_url: apiWireframe.preview_url || '',
          stories_count: apiWireframe.stories_count || 0,
          features_count: apiWireframe.features_count || 0,
          generated_at: apiWireframe.generated_at || new Date().toISOString(),
          is_local: true
        };

        localStorageService.createWireframe(wireframeData);
      });
      
      console.log(`✅ Successfully saved ${apiWireframes.length} wireframes to localStorage`);
    } catch (error) {
      console.error('Failed to save wireframes to localStorage:', error);
    }
  }

  // FIXED: Helper method to delete wireframe locally since deleteWireframe doesn't exist
  private deleteWireframeLocal(wireframeId: string): void {
    try {
      // Get all wireframes from localStorage
      const wireframesJson = localStorage.getItem('wireframes');
      if (!wireframesJson) return;

      const wireframes: LocalWireframe[] = JSON.parse(wireframesJson);
      const filteredWireframes = wireframes.filter(wf => wf.wireframe_id !== wireframeId);
      
      // Save back to localStorage
      localStorage.setItem('wireframes', JSON.stringify(filteredWireframes));
    } catch (error) {
      console.error('Error deleting wireframe locally:', error);
    }
  }

  // Helper method to determine page type from page name
  private determinePageType(pageName: string): LocalWireframe['page_type'] {
    const pageNameLower = pageName.toLowerCase();
    
    if (pageNameLower.includes('login') || pageNameLower.includes('auth')) return 'login';
    if (pageNameLower.includes('dashboard') || pageNameLower.includes('home')) return 'dashboard';
    if (pageNameLower.includes('profile') || pageNameLower.includes('account')) return 'profile';
    if (pageNameLower.includes('product') || pageNameLower.includes('catalog')) return 'products';
    if (pageNameLower.includes('cart') || pageNameLower.includes('basket')) return 'cart';
    if (pageNameLower.includes('checkout') || pageNameLower.includes('payment')) return 'checkout';
    if (pageNameLower.includes('search') || pageNameLower.includes('find')) return 'search';
    if (pageNameLower.includes('admin') || pageNameLower.includes('manage')) return 'admin';
    
    return 'general';
  }

  // Helper methods for template generation
  private createBasicWireframeHTML(project: LocalProject, role: string, stories: LocalUserStory[]): string {
    const storiesList = stories.map(story => 
      `<div class="story-item">
        <h4>${story.story_text}</h4>
        <p><strong>Feature:</strong> ${story.feature} | <strong>Priority:</strong> ${story.priority}</p>
      </div>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${role} Page - ${project.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: #4699DF; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .story-item { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, textarea, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        .btn { background: #4699DF; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${role} Dashboard</h1>
            <p>${project.title} - ${role} Interface</p>
        </div>
        
        <section class="stories-section">
            <h2>User Stories</h2>
            ${storiesList}
        </section>
        
        <section class="interaction-section">
            <h2>Main Interface</h2>
            <form>
                <div class="form-group">
                    <label for="action">Primary Action:</label>
                    <select id="action">
                        <option value="">Select an action</option>
                        ${stories.map(story => `<option value="${story.action}">${story.action}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="data">Data Input:</label>
                    <textarea id="data" rows="3" placeholder="Enter relevant data..."></textarea>
                </div>
                <button type="submit" class="btn">Submit</button>
            </form>
        </section>
    </div>
</body>
</html>`;
  }

  private generateCreoleDocumentation(project: LocalProject, role: string, stories: LocalUserStory[]): string {
    return `= ${role} Page Documentation
== Overview
This page serves the ${role} role in the ${project.title} system.

== User Stories
${stories.map((story, index) => 
  `${index + 1}. ${story.story_text}
   * Feature: ${story.feature}
   * Priority: ${story.priority}
   * Points: ${story.story_points}`
).join('\n\n')}

== Interface Elements
* Main navigation area
* User story display section
* Action form for primary interactions
* Data input fields
* Submission controls`;
  }

  private generateSaltUML(project: LocalProject, role: string, stories: LocalUserStory[]): string {
    return `@startuml
actor "${role}" as User
package "${role} Page" {
  [Story Display] as Stories
  [Action Form] as Form
  [Data Input] as Input
  [Submit Handler] as Submit
}

User --> Stories : views stories
User --> Form : selects action
User --> Input : enters data
Input --> Submit : processes
Submit --> [System] : sends data

@enduml`;
  }
}

export { WireframeService };