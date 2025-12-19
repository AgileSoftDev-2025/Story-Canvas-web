import React, { useState, useEffect } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { Download, FileText, Image as ImageIcon, CheckSquare, Square, Users, Layout, FileCode, FileArchive, ChevronDown, ChevronRight, Eye, EyeOff, File, Folder, AlertCircle, Trash2, LogOut } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { localStorageService } from "../../utils/localStorageService";
import type { 
  LocalProject, 
  LocalUserStory, 
  LocalWireframe, 
  LocalScenario 
} from "../../utils/localStorageModels";
import { downloadZip } from "client-zip";
import { useAuth } from "../../context/AuthContext"; // Import auth context

interface ExportFile {
  id: string;
  name: string;
  type: 'text' | 'image';
  content?: string;
  imageUrl?: string;
  size?: number;
  selected?: boolean;
  expanded?: boolean;
  children?: ExportFile[];
}

interface ExportSection {
  id: string;
  name: string;
  type: 'section';
  expanded: boolean;
  selected: boolean;
  files: ExportFile[];
}

export default function ExportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, logout } = useAuth(); // Get auth state
  
  const [sections, setSections] = useState<ExportSection[]>([
    { 
      id: 'overview', 
      name: "Project Overview", 
      type: 'section',
      expanded: false, 
      selected: true, 
      files: [] 
    },
    { 
      id: 'stories', 
      name: "User Stories", 
      type: 'section',
      expanded: false, 
      selected: true, 
      files: [] 
    },
    { 
      id: 'wireframes', 
      name: "Wireframes", 
      type: 'section',
      expanded: false, 
      selected: true, 
      files: [] 
    },
    { 
      id: 'scenarios', 
      name: "Test Scenarios", 
      type: 'section',
      expanded: false, 
      selected: true, 
      files: [] 
    },
  ]);

  const [projectData, setProjectData] = useState<LocalProject | null>(null);
  const [userStories, setUserStories] = useState<LocalUserStory[]>([]);
  const [wireframes, setWireframes] = useState<LocalWireframe[]>([]);
  const [scenarios, setScenarios] = useState<LocalScenario[]>([]);
  const [wireframeImages, setWireframeImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // ✅ ADDED: Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => Promise<void>>(() => async () => {});
  const [confirmMessage, setConfirmMessage] = useState("");

  // ✅ ADDED: Function to check if user is logged in
  const isLoggedIn = () => {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const currentUser = localStorage.getItem('current_user');
    
    return !!(accessToken && refreshToken && currentUser);
  };

  // ✅ ADDED: Function to clear all localStorage when NOT logged in

  const deleteProjectData = () => {
  if (!projectId) return false;
  
  try {
    console.log(`🗑️ Deleting project data for project ID: ${projectId}`);
    
    const loggedIn = isLoggedIn();
    
    if (loggedIn) {
      // If logged in: Delete only project-specific data
      console.log("🔐 User is logged in, deleting only project data...");
      
      // Get all localStorage keys
      const allKeys = Object.keys(localStorage);
      
      // List of keys that might contain project data
      const keysToRemove = allKeys.filter(key => {
        // Remove project-specific keys
        if (key.includes(projectId)) return true;
        
        // Remove specific project collections
        if (key === 'local_projects' || 
            key === 'local_user_stories' || 
            key === 'local_wireframes' || 
            key === 'local_scenarios') {
          return true;
        }
        
        return false;
      });
      
      // Remove the keys
      keysToRemove.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            // For collection keys, filter out this project's data instead of removing entire collection
            if (key === 'local_projects') {
              const projects = JSON.parse(value);
              const filteredProjects = projects.filter((p: LocalProject) => p.project_id !== projectId);
              localStorage.setItem(key, JSON.stringify(filteredProjects));
            } else if (key === 'local_user_stories') {
              const stories = JSON.parse(value);
              const filteredStories = stories.filter((s: LocalUserStory) => s.project_id !== projectId);
              localStorage.setItem(key, JSON.stringify(filteredStories));
            } else if (key === 'local_wireframes') {
              const wireframes = JSON.parse(value);
              const filteredWireframes = wireframes.filter((w: LocalWireframe) => w.project_id !== projectId);
              localStorage.setItem(key, JSON.stringify(filteredWireframes));
            } else if (key === 'local_scenarios') {
              const scenarios = JSON.parse(value);
              const filteredScenarios = scenarios.filter((s: LocalScenario) => s.project_id !== projectId);
              localStorage.setItem(key, JSON.stringify(filteredScenarios));
            } else {
              // For other keys, remove completely
              localStorage.removeItem(key);
            }
          }
        } catch (err) {
          console.error(`Error processing key ${key}:`, err);
        }
      });
      
      console.log(`✅ Removed ${keysToRemove.length} project-related keys (logged in mode)`);
      
    } else {
      // If NOT logged in: Clear ALL localStorage
      console.log("🚪 User is NOT logged in, clearing ALL localStorage...");
      localStorage.clear();
    }
    
    return true;
    
  } catch (error) {
    console.error("❌ Error deleting project data:", error);
    return false;
  }
};

  // ✅ UPDATED: Load project data with auth check
  useEffect(() => {
  if (!projectId) {
    setError("No project ID provided");
    setLoading(false);
    return;
  }

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Check if user is logged in (but DON'T clear localStorage)
      const loggedIn = isLoggedIn();
      console.log(`🔐 User logged in: ${loggedIn}`);
      
      // Get project data
      const project = localStorageService.getProject(projectId);
      if (!project) {
        setError("Project not found in local storage");
        setLoading(false);
        return;
      }
      
      setProjectData(project);
      
      // Get user stories
      const stories = localStorageService.getUserStoriesByProject(projectId);
      setUserStories(stories);
      
      // Get wireframes
      const wireframesData = localStorageService.getWireframesByProject(projectId);
      setWireframes(wireframesData);
      
      // Get scenarios from localStorage
      const allScenariosRaw = localStorage.getItem('local_scenarios');
      if (allScenariosRaw) {
        const allScenarios = JSON.parse(allScenariosRaw);
        const projectScenarios = allScenarios.filter((s: LocalScenario) => s.project_id === projectId);
        setScenarios(projectScenarios);
      }
      
      // Generate PNG images for wireframes with salt diagrams
      const imagePromises = wireframesData.map(async (wireframe) => {
        if (wireframe.salt_diagram && wireframe.salt_diagram.trim().length > 0) {
          await generatePNGFromSalt(wireframe.salt_diagram, wireframe.wireframe_id);
        }
      });
      
      await Promise.all(imagePromises);
      
      // Build file structure
      updateFileStructure(project, stories, wireframesData, scenarios);
      
      setLoading(false);
      
    } catch (err) {
      console.error("Error loading project data:", err);
      setError("Failed to load project data");
      setLoading(false);
    }
  };

  loadData();
}, [projectId]);

  // Function to generate PNG from Salt UML
  const generatePNGFromSalt = async (saltCode: string, wireframeId: string): Promise<{ success: boolean; png_url?: string; error?: string }> => {
    if (!saltCode || saltCode.trim().length === 0) {
      return { success: false, error: 'No Salt UML code provided' };
    }

    try {
      const response = await fetch('/api/plantuml/generate-png/', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ salt_code: saltCode })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.png_url) {
        setWireframeImages(prev => ({
          ...prev,
          [wireframeId]: data.png_url
        }));
        return { success: true, png_url: data.png_url };
      } else {
        return { success: false, error: data.error || 'Failed to generate PNG' };
      }
    } catch (error) {
      console.error('Failed to generate PNG:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  };

  // Update file structure when data loads
  const updateFileStructure = (
    project: LocalProject, 
    stories: LocalUserStory[], 
    wireframesData: LocalWireframe[], 
    scenariosData: LocalScenario[]
  ) => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const projectName = project.title.replace(/\s+/g, '_');
    
    // Generate Project Overview files
    const overviewFiles: ExportFile[] = [
      {
        id: 'readme',
        name: `README.txt`,
        type: 'text',
        content: generateReadmeContent(project),
        size: generateReadmeContent(project).length,
        selected: true
      },
      {
        id: 'overview',
        name: `project_overview.txt`,
        type: 'text',
        content: generateProjectOverview(project, stories, wireframesData, scenariosData),
        size: generateProjectOverview(project, stories, wireframesData, scenariosData).length,
        selected: true
      }
    ];

    // Generate User Stories files
    const storiesFiles: ExportFile[] = [
      {
        id: 'stories_all',
        name: `user_stories.txt`,
        type: 'text',
        content: generateUserStoriesText(stories),
        size: generateUserStoriesText(stories).length,
        selected: true
      },
      ...stories.map((story, index) => ({
        id: `story_${story.story_id}`,
        name: `story_${index + 1}_${story.role.replace(/\s+/g, '_')}.txt`,
        type: 'text' as const,
        content: generateSingleStoryText(story, index),
        size: generateSingleStoryText(story, index).length,
        selected: true
      }))
    ];

    // Generate Wireframes files
    const wireframesFiles: ExportFile[] = [
      {
        id: 'wireframes_data',
        name: `wireframe_data.txt`,
        type: 'text',
        content: generateWireframeData(wireframesData),
        size: generateWireframeData(wireframesData).length,
        selected: true
      },
      ...wireframesData.map((wireframe, index) => ({
        id: `wireframe_${wireframe.wireframe_id}`,
        name: `${wireframe.page_name.replace(/\s+/g, '_')}.png`,
        type: 'image' as const,
        imageUrl: wireframeImages[wireframe.wireframe_id],
        size: 0, // Will be fetched when needed
        selected: true
      }))
    ];

    // Generate Scenarios files
    const scenariosFiles: ExportFile[] = [
      {
        id: 'scenarios_all',
        name: `test_scenarios.txt`,
        type: 'text',
        content: generateScenariosText(scenariosData),
        size: generateScenariosText(scenariosData).length,
        selected: true
      },
      ...scenariosData.map((scenario, index) => ({
        id: `scenario_${scenario.scenario_id}`,
        name: `scenario_${index + 1}_${scenario.scenario_type}.txt`,
        type: 'text' as const,
        content: generateSingleScenarioText(scenario, index),
        size: generateSingleScenarioText(scenario, index).length,
        selected: true
      }))
    ];

    // Update sections with files
    setSections(prev => prev.map(section => {
      switch(section.id) {
        case 'overview':
          return { ...section, files: overviewFiles };
        case 'stories':
          return { ...section, files: storiesFiles };
        case 'wireframes':
          return { ...section, files: wireframesFiles };
        case 'scenarios':
          return { ...section, files: scenariosFiles };
        default:
          return section;
      }
    }));
  };

  // Content generation functions
  const generateReadmeContent = (project: LocalProject) => {
    const loggedIn = isLoggedIn();
    return `Project Export: ${project.title}
Generated: ${new Date().toLocaleString()}
Project ID: ${project.project_id}
User Status: ${loggedIn ? 'Logged In' : 'Not Logged In'}
==============================================

This ZIP contains exported project data including:
• Project Overview
• User Stories
• Wireframes
• Test Scenarios

${loggedIn ? 'Note: After export, only project data will be deleted from the application. Your account remains active.' : 'Warning: You are not logged in. After export, all data will be permanently deleted from this browser.'}

All files are organized by category for easy reference.`;
  };

  const generateProjectOverview = (
    project: LocalProject, 
    stories: LocalUserStory[], 
    wireframesData: LocalWireframe[], 
    scenariosData: LocalScenario[]
  ) => {
    const loggedIn = isLoggedIn();
    return `PROJECT OVERVIEW
====================
Project Title: ${project.title || "Untitled Project"}
Project ID: ${project.project_id}
Domain: ${project.domain || "Not specified"}
Language: ${project.language || "Not specified"}
User Status: ${loggedIn ? 'Authenticated User' : 'Guest User'}
Created: ${formatDate(project.created_at)}
Updated: ${formatDate(project.updated_at)}

OBJECTIVE:
${project.objective || "No objective provided"}

SCOPE:
${project.scope || "No scope defined"}

FLOW:
${project.flow || "No flow description"}

ADDITIONAL INFO:
${project.additional_info || "No additional information"}

USERS:
${project.users_data && project.users_data.length > 0 
  ? project.users_data.map(user => `• ${user}`).join('\n')
  : "No users defined"}

FEATURES:
${project.features_data && project.features_data.length > 0 
  ? project.features_data.map(feature => `• ${feature}`).join('\n')
  : "No features defined"}

PROJECT STATISTICS:
• User Stories: ${stories.length}
• Wireframes: ${wireframesData.length}
• Test Scenarios: ${scenariosData.length}
• Status: ${project.status || "active"}
====================\n\n`;
  };

  const generateSingleStoryText = (story: LocalUserStory, index: number) => {
    return `USER STORY ${index + 1}
====================
ID: ${story.story_id}
Story: ${story.story_text}
Role: ${story.role}
Action: ${story.action}
Benefit: ${story.benefit}
Feature: ${story.feature || "Not specified"}
Priority: ${story.priority || "medium"}
Story Points: ${story.story_points || 0}
Status: ${story.status || "draft"}
Created: ${formatDate(story.created_at)}
Updated: ${formatDate(story.updated_at)}

ACCEPTANCE CRITERIA:
${story.acceptance_criteria && story.acceptance_criteria.length > 0 
  ? story.acceptance_criteria.map((criteria: string) => `• ${criteria}`).join('\n')
  : "No acceptance criteria defined"}

GENERATED BY LLM: ${story.generated_by_llm ? "Yes" : "No"}
ITERATION: ${story.iteration || 1}`;
  };

  const generateUserStoriesText = (stories: LocalUserStory[]) => {
    if (stories.length === 0) return "No user stories found.\n\n";
    
    let content = `USER STORIES (${stories.length})
====================\n\n`;
    
    stories.forEach((story, index) => {
      content += generateSingleStoryText(story, index) + '\n\n';
    });
    
    return content;
  };

  const generateSingleScenarioText = (scenario: LocalScenario, index: number) => {
    return `SCENARIO ${index + 1}
====================
ID: ${scenario.scenario_id}
Title: ${scenario.title || "Untitled Scenario"}
Type: ${scenario.scenario_type || "unknown"}
Status: ${scenario.status || "draft"}
Created: ${formatDate(scenario.created_at)}
Updated: ${formatDate(scenario.updated_at)}

STORY REFERENCE:
${scenario.user_story_id ? `User Story ID: ${scenario.user_story_id}` : "Not linked to specific user story"}

SCENARIO DESCRIPTION:
${scenario.scenario_text || "No description provided"}

GHERKIN STEPS:
${scenario.gherkin_steps && scenario.gherkin_steps.length > 0 
  ? scenario.gherkin_steps.map((step: string) => `• ${step}`).join('\n')
  : "No Gherkin steps defined"}

METADATA:
• Domain: ${scenario.detected_domain || "Not detected"}
• Proper Structure: ${scenario.has_proper_structure ? "Yes" : "No"}
• Enhanced with LLM: ${scenario.enhanced_with_llm ? "Yes" : "No"}`;
  };

  const generateScenariosText = (scenariosData: LocalScenario[]) => {
    if (scenariosData.length === 0) return "No test scenarios found.\n\n";
    
    let content = `TEST SCENARIOS (${scenariosData.length})
====================\n\n`;
    
    scenariosData.forEach((scenario, index) => {
      content += generateSingleScenarioText(scenario, index) + '\n\n';
    });
    
    return content;
  };

  const generateWireframeData = (wireframesData: LocalWireframe[]) => {
    if (wireframesData.length === 0) return "No wireframes found.\n\n";
    
    let content = `WIREFRAMES (${wireframesData.length})
====================\n\n`;
    
    wireframesData.forEach((wireframe, index) => {
      content += `WIREFRAME ${index + 1}:
-----------------------------
ID: ${wireframe.wireframe_id}
Page Name: ${wireframe.page_name}
Page Type: ${wireframe.page_type || "general"}
Description: ${wireframe.description || "No description"}
Created: ${formatDate(wireframe.created_at)}
Updated: ${formatDate(wireframe.updated_at)}
Generated At: ${formatDate(wireframe.generated_at)}

CREOLE CONTENT:
${wireframe.creole_content || "No creole content"}

SALT DIAGRAM:
${wireframe.salt_diagram || "No salt diagram"}

HTML CONTENT LENGTH: ${wireframe.html_content?.length || 0} characters
Wireframe Type: ${wireframe.wireframe_type || "desktop"}
Version: ${wireframe.version || 1}
Stories Count: ${wireframe.stories_count || 0}
Features Count: ${wireframe.features_count || 0}
Generated with RAG: ${wireframe.generated_with_rag ? "Yes" : "No"}
IS LOCAL: ${wireframe.is_local ? "Yes" : "No"}
-----------------------------\n\n`;
    });
    
    return content;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, expanded: !section.expanded }
        : section
    ));
  };

  // Toggle section selection
  const toggleSectionSelection = (sectionId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, selected: !section.selected }
        : section
    ));
  };

  // Toggle file selection
  const toggleFileSelection = (sectionId: string, fileId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          files: section.files.map(file =>
            file.id === fileId
              ? { ...file, selected: !file.selected }
              : file
          )
        };
      }
      return section;
    }));
  };

  // Select all files in a section
  const selectAllInSection = (sectionId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        const allSelected = section.files.every(file => file.selected);
        return {
          ...section,
          files: section.files.map(file => ({
            ...file,
            selected: !allSelected
          }))
        };
      }
      return section;
    }));
  };

  // Show file preview
  const showFilePreview = (file: ExportFile) => {
    if (file.type === 'text') {
      setPreviewContent(file.content || 'No content available');
      setPreviewImage(null);
    } else if (file.type === 'image' && file.imageUrl) {
      setPreviewImage(file.imageUrl);
      setPreviewContent(null);
    }
  };

  // Select all sections
  const selectAllSections = () => {
    const allSelected = sections.every(section => section.selected);
    setSections(prev => prev.map(section => ({
      ...section,
      selected: !allSelected,
      files: section.files.map(file => ({
        ...file,
        selected: !allSelected
      }))
    })));
  };

  // Download image and convert to blob
  const fetchImageAsBlob = async (url: string): Promise<Blob> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    return await response.blob();
  };

  // ✅ ADDED: Confirmation dialog function
  const showConfirmation = (action: () => Promise<void>, message: string) => {
    setConfirmAction(() => action);
    setConfirmMessage(message);
    setShowConfirmDialog(true);
  };

  const exportAndDeleteProject = async () => {
  const selectedSections = sections.filter(section => section.selected);
  
  if (selectedSections.length === 0) {
    alert("Pilih minimal satu bagian untuk diexport!");
    return;
  }

  if (!projectData) {
    alert("Project data not loaded!");
    return;
  }

  try {
    setExporting(true);
    
    const timestamp = new Date().toISOString().slice(0, 10);
    const projectName = projectData.title.replace(/\s+/g, '_');
    const zipFiles = [];
    const now = new Date();

    // Add all selected files
    for (const section of selectedSections) {
      for (const file of section.files) {
        if (file.selected) {
          if (file.type === 'text' && file.content) {
            zipFiles.push({
              name: `${section.id}/${file.name}`,
              lastModified: now,
              input: file.content
            });
          } else if (file.type === 'image' && file.imageUrl) {
            try {
              const blob = await fetchImageAsBlob(file.imageUrl);
              const arrayBuffer = await blob.arrayBuffer();
              zipFiles.push({
                name: `${section.id}/${file.name}`,
                lastModified: now,
                input: arrayBuffer
              });
            } catch (error) {
              console.error(`Failed to fetch image ${file.name}:`, error);
            }
          }
        }
      }
    }

    // Add README file
    const loggedIn = isLoggedIn();
    const readmeContent = `Project Export: ${projectData.title}
Generated: ${new Date().toLocaleString()}
Project ID: ${projectId}
User Status: ${loggedIn ? 'Logged In' : 'Not Logged In'}
==============================================

This ZIP contains the following sections:
${selectedSections.map(section => `- ${section.name}`).join('\n')}

Total files: ${zipFiles.length}
${loggedIn 
  ? 'Note: After export, only project data was deleted. Your account remains active.'
  : 'Warning: You are not logged in. All data has been cleared from this browser.'}`;
    
    zipFiles.unshift({
      name: "README.txt",
      lastModified: now,
      input: readmeContent
    });

    // Generate and download ZIP using client-zip
    const blob = await downloadZip(zipFiles).blob();
    const zipFilename = `${projectName}_export_${timestamp}.zip`;
    
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = zipFilename;
    link.click();
    
    // Clean up
    URL.revokeObjectURL(link.href);
    
    console.log("✅ ZIP export completed");
    
    // ✅ NOW DELETE THE PROJECT DATA (only after successful export!)
    console.log("🗑️ Deleting project data from localStorage...");
    const deleteSuccess = deleteProjectData();
    
    if (deleteSuccess) {
      const message = loggedIn 
        ? `✅ Export successful! Project "${projectData.title}" has been exported. Your account data is preserved.`
        : `✅ Export successful! Project "${projectData.title}" has been exported. All data has been cleared from this browser.`;
      
      console.log(message);
      
      setTimeout(() => {
        alert(message);
        navigate("/"); // Redirect to projects page
      }, 500);
    } else {
      alert("⚠️ Export completed, but there was an issue removing the project from storage.");
      navigate("/");
    }
    
    setExporting(false);
    
  } catch (error) {
    console.error("Error exporting as ZIP:", error);
    alert("❌ Error exporting as ZIP. Please try again.");
    setExporting(false);
  }
};

  // ✅ UPDATED: Handle Export as ZIP with confirmation based on auth status
  const handleExportAsZip = () => {
    if (totalSelectedFiles === 0) {
      alert("Pilih minimal satu file untuk diexport!");
      return;
    }

    const loggedIn = isLoggedIn();
    const warningMessage = loggedIn
      ? `Export ${totalSelectedFiles} file(s)?\n\n⚠️ After export, project data will be deleted but your account (access token, refresh token, user info) will be preserved.`
      : `Export ${totalSelectedFiles} file(s)?\n\n🚨 WARNING: You are NOT logged in!\n\nAfter export, ALL data in this browser will be permanently deleted, including:\n• Project data\n• User stories\n• Wireframes\n• Test scenarios\n\nPlease login if you want to preserve your account data.`;

    showConfirmation(
      exportAndDeleteProject,
      warningMessage
    );
  };

  // Helper function to download text files
  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Helper function to download images
  const downloadImage = (filename: string, imageUrl: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename;
    link.click();
  };

  // Handle individual file export
  const handleIndividualFileExport = (file: ExportFile) => {
    if (!projectData) return;
    
    const timestamp = new Date().toISOString().slice(0, 10);
    const projectName = projectData.title.replace(/\s+/g, '_');
    
    if (file.type === 'text' && file.content) {
      downloadTextFile(`${projectName}_${file.name}`, file.content);
    } else if (file.type === 'image' && file.imageUrl) {
      downloadImage(`${projectName}_${file.name}`, file.imageUrl);
    }
  };

  // Calculate total selected files
  const totalSelectedFiles = sections.reduce((total, section) => {
    if (section.selected) {
      return total + section.files.filter(file => file.selected).length;
    }
    return total;
  }, 0);

  // Calculate total files in selected sections
  const totalFilesInSelectedSections = sections.reduce((total, section) => {
    if (section.selected) {
      return total + section.files.length;
    }
    return total;
  }, 0);

  // ✅ ADDED: Function to handle logout
  const handleLogout = () => {
    const loggedIn = isLoggedIn();
    if (loggedIn) {
      logout();
      alert("You have been logged out. Your auth data has been cleared.");
      navigate("/");
    } else {
      alert("You are already logged out.");
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f9fafb]">
        <Header />
        <main className="flex-1 px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white shadow-md rounded-xl p-6 mb-6">
              <div className="flex flex-col items-center justify-center h-64">
                <div className="text-lg text-gray-600 mb-4">Loading project data...</div>
                <div className="w-full max-w-md">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-400 to-blue-500 animate-pulse"></div>
                  </div>
                </div>
                <div className="text-sm text-gray-500 mt-4">
                  Preparing your project for export...
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f9fafb]">
        <Header />
        <main className="flex-1 px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white shadow-md rounded-xl p-6 mb-6">
              <div className="flex flex-col items-center justify-center h-64">
                <div className="text-red-500 text-lg mb-4 text-center">
                  <div className="font-semibold">Error</div>
                  <div className="text-sm mt-2">{error}</div>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => navigate(-1)}
                    className="rounded-lg bg-blue-500 px-6 py-2 text-white font-medium hover:bg-blue-600 transition"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-green-500 px-6 py-2 text-white font-medium hover:bg-green-600 transition"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const loggedIn = isLoggedIn();

  return (
    <div className="flex flex-col min-h-screen bg-[#f9fafb]">
      <Header />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header with Auth Status */}
          <div className="bg-white shadow-md rounded-xl p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-[#3E4766]">
                  Export Project: {projectData?.title}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Project ID: <span className="font-mono">{projectId}</span>
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-sm text-gray-600">
                    📝 {userStories.length} user stories
                  </span>
                  <span className="text-sm text-gray-600">
                    🎨 {wireframes.length} wireframes
                  </span>
                  <span className="text-sm text-gray-600">
                    🧪 {scenarios.length} scenarios
                  </span>
                  <span className={`text-sm px-2 py-1 rounded-full ${loggedIn ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {loggedIn ? '✅ Logged In' : '🚫 Not Logged In'}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={selectAllSections}
                  className="rounded-lg bg-gray-500 px-4 py-2 text-white font-medium hover:bg-gray-600 transition"
                >
                  {sections.every(section => section.selected) ? "Unselect All" : "Select All"}
                </button>
                {loggedIn && (
                  <button
                    onClick={handleLogout}
                    className="rounded-lg bg-red-500 px-4 py-2 text-white font-medium hover:bg-red-600 transition flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* File Explorer & Preview Container */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* File Explorer - 2/3 width */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow-md rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-800">
                    File Explorer
                  </h2>
                  <div className="text-sm text-gray-500">
                    {totalSelectedFiles} of {totalFilesInSelectedSections} files selected
                  </div>
                </div>

                <div className="space-y-2">
                  {sections.map((section) => (
                    <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Section Header */}
                      <div 
                        className={`p-4 flex items-center justify-between cursor-pointer transition ${
                          section.selected ? 'bg-blue-50' : 'bg-gray-50'
                        }`}
                        onClick={() => toggleSection(section.id)}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSectionSelection(section.id);
                            }}
                            className="flex items-center justify-center"
                          >
                            {section.selected ? (
                              <CheckSquare className="w-5 h-5 text-[#4699DF]" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          <div className="flex items-center gap-2">
                            {section.expanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                            <Folder className="w-5 h-5 text-[#4699DF]" />
                            <h3 className="font-medium text-gray-800">{section.name}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllInSection(section.id);
                            }}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Select all
                          </button>
                          <span className="text-xs text-gray-500">
                            {section.files.filter(f => f.selected).length}/{section.files.length} files
                          </span>
                        </div>
                      </div>

                      {/* Files List */}
                      {section.expanded && (
                        <div className="border-t border-gray-200 bg-white">
                          {section.files.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                              {section.files.map((file) => (
                                <div 
                                  key={file.id}
                                  className={`p-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${
                                    !file.selected ? 'opacity-60' : ''
                                  }`}
                                  onClick={() => showFilePreview(file)}
                                >
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFileSelection(section.id, file.id);
                                      }}
                                      className="flex items-center justify-center"
                                    >
                                      {file.selected ? (
                                        <CheckSquare className="w-4 h-4 text-[#4699DF]" />
                                      ) : (
                                        <Square className="w-4 h-4 text-gray-400" />
                                      )}
                                    </button>
                                    <div className="flex items-center gap-2">
                                      {file.type === 'text' ? (
                                        <FileText className="w-4 h-4 text-gray-500" />
                                      ) : (
                                        <ImageIcon className="w-4 h-4 text-gray-500" />
                                      )}
                                      <span className="text-sm text-gray-700 truncate max-w-[200px]">
                                        {file.name}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {file.size && file.size > 0 && (
                                      <span className="text-xs text-gray-500">
                                        {Math.ceil(file.size / 1024)} KB
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleIndividualFileExport(file);
                                      }}
                                      className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                                      title="Download this file"
                                    >
                                      <Download className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        showFilePreview(file);
                                      }}
                                      className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                                      title="Preview this file"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-gray-500">
                              No files available in this section
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview Panel - 1/3 width */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow-md rounded-xl p-6 h-full">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-800">File Preview</h2>
                  <div className="text-sm text-gray-500">
                    {previewContent || previewImage ? 'Previewing' : 'Select a file'}
                  </div>
                </div>

                {previewContent ? (
                  <div className="h-[500px] flex flex-col">
                    <div className="mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#4699DF]" />
                      <span className="text-sm font-medium text-gray-700">Text Preview</span>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg border border-gray-200 h-full">
                        {previewContent.length > 5000 
                          ? previewContent.substring(0, 5000) + '\n\n... (truncated, full content will be in export)'
                          : previewContent
                        }
                      </pre>
                    </div>
                  </div>
                ) : previewImage ? (
                  <div className="h-[500px] flex flex-col">
                    <div className="mb-3 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-[#4699DF]" />
                      <span className="text-sm font-medium text-gray-700">Image Preview</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="w-full h-full object-contain rounded-lg border border-gray-200"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-[500px] flex flex-col items-center justify-center text-gray-400">
                    <EyeOff className="w-12 h-12 mb-4" />
                    <p className="text-sm">Select a file to preview its content</p>
                    <p className="text-xs mt-2">Click on any file in the explorer</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    {previewContent 
                      ? `Text length: ${previewContent.length} characters` 
                      : previewImage 
                        ? 'Image preview' 
                        : 'No file selected'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="bg-white shadow-md rounded-xl p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Export Summary</h2>
                <p className="text-sm text-gray-500">
                  {totalSelectedFiles} files selected across {sections.filter(s => s.selected).length} sections • 
                  {sections.find(s => s.id === 'wireframes' && s.selected) ? ' Includes images' : ' Text only'}
                </p>
                {/* ✅ UPDATED: Warning message based on auth status */}
                <div className={`mt-2 flex items-center gap-2 ${loggedIn ? 'text-amber-600' : 'text-red-600'} text-sm`}>
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    {loggedIn 
                      ? 'After export, only project data will be deleted. Your account data will be preserved.'
                      : '🚨 WARNING: You are NOT logged in! After export, ALL data will be permanently deleted from this browser.'
                    }
                  </span>
                </div>
                {!loggedIn && (
                  <div className="mt-2 text-blue-600 text-sm">
                    💡 Tip: Login before exporting to preserve your account data for future sessions.
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleExportAsZip}
                  disabled={exporting || totalSelectedFiles === 0}
                  className={`flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-5 py-3 text-white font-medium shadow-sm hover:opacity-95 ${
                    exporting ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                >
                  <FileArchive className="w-5 h-5" />
                  {exporting ? 'Creating ZIP...' : `Export as ZIP (${totalSelectedFiles} files)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* ✅ UPDATED: Confirmation Dialog with auth-specific warnings */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    loggedIn ? 'bg-amber-100' : 'bg-red-100'
                  }`}>
                    <AlertCircle className={`w-5 h-5 ${loggedIn ? 'text-amber-600' : 'text-red-600'}`} />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Confirm Export & Delete
                  </h3>
                  <div className="text-gray-600 whitespace-pre-line">
                    {confirmMessage}
                  </div>
                  
                  <div className={`mt-4 p-3 border rounded-lg ${
                    loggedIn ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className={`flex items-center gap-2 font-medium ${
                      loggedIn ? 'text-amber-700' : 'text-red-700'
                    }`}>
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">
                        {loggedIn 
                          ? 'Project data will be permanently deleted'
                          : 'ALL DATA will be permanently deleted'
                        }
                      </span>
                    </div>
                    <ul className={`mt-2 text-xs space-y-1 ${
                      loggedIn ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      <li>• Project data will be removed from localStorage</li>
                      <li>• User stories will be deleted</li>
                      <li>• Wireframes will be deleted</li>
                      <li>• Test scenarios will be deleted</li>
                      {loggedIn ? (
                        <>
                          <li>• ✅ Access token will be preserved</li>
                          <li>• ✅ Refresh token will be preserved</li>
                          <li>• ✅ User account data will be preserved</li>
                        </>
                      ) : (
                        <>
                          <li>• ❌ No auth data will be preserved</li>
                          <li>• ❌ All localStorage will be cleared</li>
                          <li>• ⚠️ You will need to login again</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowConfirmDialog(false);
                    await confirmAction();
                  }}
                  className={`px-4 py-2 rounded-lg font-medium hover:opacity-90 transition flex items-center gap-2 ${
                    loggedIn 
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white'
                      : 'bg-gradient-to-r from-red-600 to-red-500 text-white'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  {loggedIn ? 'Export & Delete Project' : 'Export & Clear All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}