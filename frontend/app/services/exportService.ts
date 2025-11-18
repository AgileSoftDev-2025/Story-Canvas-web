export interface ExportConfig {
  include_stories: boolean;
  include_wireframes: boolean;
  include_scenarios: boolean;
  format: "zip";
}

export interface FallbackProjectData {
  project_id: string;
  title: string;
  domain: string;
  objective: string;
  user_stories: any[];
  wireframes: any[];
  scenarios: any[];
  export_config?: {
    include_stories: boolean;
    include_wireframes: boolean;
    include_scenarios: boolean;
    format: string;
  };
}

class ExportService {
  private baseURL = "http://127.0.0.1:8000/api";

  private async makeRequest(url: string, options: RequestInit = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.error("❌ Request failed:", error);
      throw error;
    }
  }

  async getExportPreview(projectId: string, config: any) {
    try {
      console.log("🔍 Fetching preview for project:", projectId);

      const params = new URLSearchParams({
        include_stories: "true",
        include_wireframes: "true",
        include_scenarios: "true",
      });

      const response = await this.makeRequest(`${this.baseURL}/projects/${projectId}/export-preview/?${params}`, { method: "GET" });

      const data = await response.json();
      console.log("✅ Preview data received");
      return data;
    } catch (error: any) {
      console.error("❌ Failed to get export preview:", error);
      throw new Error(`Cannot connect to backend: ${error}`);
    }
  }

  async exportProject(projectId: string, config: ExportConfig): Promise<Blob> {
    try {
      console.log("📤 Starting export...");

      const response = await this.makeRequest(`${this.baseURL}/projects/${projectId}/export/`, {
        method: "POST",
        body: JSON.stringify({ config }),
      });

      return await response.blob();
    } catch (error: any) {
      console.error("❌ Export failed:", error);
      throw new Error(`Export failed: ${error}`);
    }
  }

  // NEW: Client-side export for fallback mode
  async exportFallbackProject(projectData: FallbackProjectData, config: ExportConfig): Promise<Blob> {
    return new Promise((resolve, reject) => {
      console.log("📤 Starting fallback export...");

      // Import JSZip dynamically
      import("jszip")
        .then((JSZip) => {
          try {
            const zip = new JSZip.default();

            // Add project info
            const projectInfo = {
              title: projectData.title,
              domain: projectData.domain,
              objective: projectData.objective,
              exported_at: new Date().toISOString(),
              note: "Exported in demo mode - Backend connection required for full functionality",
            };

            zip.file("project_info.json", JSON.stringify(projectInfo, null, 2));

            // Add user stories if selected
            if (config.include_stories && projectData.user_stories.length > 0) {
              const storiesContent = this.generateStoriesContent(projectData);
              zip.file("user_stories.md", storiesContent);
            }

            // Add wireframes if selected
            if (config.include_wireframes && projectData.wireframes.length > 0) {
              const wireframesContent = this.generateWireframesContent(projectData);
              zip.file("wireframes.md", wireframesContent);
            }

            // Add scenarios if selected
            if (config.include_scenarios && projectData.scenarios.length > 0) {
              const scenariosContent = this.generateScenariosContent(projectData);
              zip.file("test_scenarios.feature", scenariosContent);
            }

            // Add README
            const readmeContent = this.generateReadmeContent(projectData, config);
            zip.file("README.md", readmeContent);

            // Generate zip file
            zip.generateAsync({ type: "blob" }).then((blob) => {
              console.log("✅ Fallback export completed");
              resolve(blob);
            });
          } catch (error) {
            console.error("❌ Fallback export failed:", error);
            reject(new Error(`Fallback export failed: ${error}`));
          }
        })
        .catch((error) => {
          console.error("❌ JSZip import failed:", error);
          reject(new Error("Failed to load export library"));
        });
    });
  }

  // Helper methods for generating content
  private generateStoriesContent(projectData: FallbackProjectData): string {
    const stories = projectData.user_stories;

    let content = `# User Stories - ${projectData.title}\n\n`;
    content += `**Domain:** ${projectData.domain}\n\n`;
    content += `**Objective:** ${projectData.objective}\n\n`;

    const roles: { [key: string]: any[] } = {};
    for (const story of stories) {
      const role = story.role || "General";
      if (!roles[role]) {
        roles[role] = [];
      }
      roles[role].push(story);
    }

    for (const [role, roleStories] of Object.entries(roles)) {
      content += `## ${role}\n\n`;
      for (const story of roleStories) {
        content += `### ${story.action}\n\n`;
        content += `- **As a ${story.role}**, ${story.action} **so that** ${story.benefit}\n`;
        if (story.acceptance_criteria) {
          content += `- **Acceptance Criteria:** ${story.acceptance_criteria}\n`;
        }
        if (story.priority) {
          content += `- **Priority:** ${story.priority}\n`;
        }
        if (story.status) {
          content += `- **Status:** ${story.status}\n`;
        }
        content += "\n";
      }
    }

    return content;
  }

  private generateWireframesContent(projectData: FallbackProjectData): string {
    const wireframes = projectData.wireframes;

    let content = `# Wireframes - ${projectData.title}\n\n`;
    content += `**Total Wireframes:** ${wireframes.length}\n\n`;

    for (const wireframe of wireframes) {
      content += `## ${wireframe.title || "Untitled Wireframe"}\n\n`;
      content += `- **Page Type:** ${wireframe.page_type || "N/A"}\n`;
      content += `- **Description:** ${wireframe.description || "No description"}\n`;
      if (wireframe.creole_content) {
        content += `- **Content:**\n\`\`\`\n${wireframe.creole_content}\n\`\`\`\n`;
      }
      content += "\n";
    }

    return content;
  }

  private generateScenariosContent(projectData: FallbackProjectData): string {
    const scenarios = projectData.scenarios;

    let content = `Feature: Test Scenarios for ${projectData.title}\n\n`;

    for (const scenario of scenarios) {
      content += `Scenario: ${scenario.title}\n`;
      if (scenario.description) {
        content += `  ${scenario.description}\n`;
      }

      if (scenario.given_steps) {
        const steps = Array.isArray(scenario.given_steps) ? scenario.given_steps : scenario.given_steps.split("\n");
        for (const step of steps) {
          if (step.trim()) {
            content += `  Given ${step.trim()}\n`;
          }
        }
      }

      if (scenario.when_steps) {
        const steps = Array.isArray(scenario.when_steps) ? scenario.when_steps : scenario.when_steps.split("\n");
        for (const step of steps) {
          if (step.trim()) {
            content += `  When ${step.trim()}\n`;
          }
        }
      }

      if (scenario.then_steps) {
        const steps = Array.isArray(scenario.then_steps) ? scenario.then_steps : scenario.then_steps.split("\n");
        for (const step of steps) {
          if (step.trim()) {
            content += `  Then ${step.trim()}\n`;
          }
        }
      }

      content += "\n";
    }

    return content;
  }

  private generateReadmeContent(projectData: FallbackProjectData, config: ExportConfig): string {
    let content = `# ${projectData.title} - Export Package\n\n`;
    content += "This package contains exported project artifacts from Story Canvas.\n\n";
    content += "> **Note:** This export was generated in demo mode. Backend connection is required for full functionality.\n\n";

    content += "## Contents\n\n";
    if (config.include_stories) {
      content += "- `user_stories.md`: All user stories in Markdown format\n";
    }
    if (config.include_wireframes) {
      content += "- `wireframes.md`: Wireframe descriptions and details\n";
    }
    if (config.include_scenarios) {
      content += "- `test_scenarios.feature`: Test scenarios in Gherkin format\n";
    }
    content += "- `project_info.json`: Project metadata\n\n";

    content += "## Project Information\n\n";
    content += `- **Title:** ${projectData.title}\n`;
    content += `- **Domain:** ${projectData.domain}\n`;
    content += `- **Objective:** ${projectData.objective}\n`;
    content += `- **Export Date:** ${new Date().toLocaleString()}\n`;
    content += `- **Mode:** Demo Export\n\n`;

    content += "---\n*Generated by Story Canvas*\n";

    return content;
  }

  downloadFile(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
