export type StorySections = {
  individual: string;
  advisors: string;
  managers: string;
  admins: string;
};

export const DEFAULT_STORY: StorySections = {
  individual: `1. As an Individual User, I want to link my bank accounts so that the system can automatically track and categorize my transactions.
2. As an Individual User, I need to receive AI-driven budgeting recommendations so that I can better manage my finances.
3. As an Individual User, I should be able to get personalized investment portfolio suggestions so that I can make informed investment decisions.`,
  advisors: `1. As a Financial Advisor, I want to review my clients' personalized investment portfolio suggestions so that I can provide tailored advice and recommendations.
2. As a Financial Advisor, I need to access real-time stock and crypto tracking data to stay informed about my clients' investments and market trends so that I can make timely and informed decisions.
3. As a Financial Advisor, I should be able to monitor my clients' portfolio performance and receive risk analysis alerts so that I can proactively address any potential issues and adjust their investment strategies.`,
  managers: `1. As an Investment Manager, I want to review personalized investment portfolio suggestions for my clients so that I can make informed decisions and offer tailored advice.
2. As an Investment Manager, I need to monitor real-time stock and crypto tracking for my clients' portfolios so that I can provide timely updates and alerts.
3. As an Investment Manager, I should be able to access risk analysis and alerts for my clients' portfolios so that I can proactively manage and mitigate potential risks.`,
  admins: `1. As an Administrator, I want to manage user account access levels so that I can control data visibility and functionality for different user roles (Individual Users, Financial Advisors, Investment Managers).
2. As an Administrator, I need to monitor system performance and usage metrics to ensure the platform's reliability and efficiency.
3. As an Administrator, I should be able to configure and manage third-party API integrations for bank connections, stock market data, and crypto exchange feeds.`,
};

const STORAGE_KEY = "storycanvas.userstory";
const API_BASE = process.env.VITE_API_BASE || 'http://localhost:8000/api';

// Types for API responses
export interface UserStoryPageStatus {
  is_accepted: boolean;
  accepted_at: string | null;
  version: number;
  has_content: boolean;
}

export interface UserStoryPageResponse {
  id: string;
  project_id: string;
  version: number;
  is_accepted: boolean;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  individual: string;
  advisors: string;
  managers: string;
  admins: string;
  project?: {
    project_id: string;
    title: string;
    status: string;
  };
}

function canUseDOM() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// ========== UPDATED FUNCTIONS WITH API INTEGRATION ==========

/**
 * Load story from API with localStorage fallback
 */
export async function loadStory(projectId?: string): Promise<StorySections> {
  // If projectId is provided, try to load from API
  if (projectId) {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/user-story-page/`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data) {
          // Also save to localStorage for offline access
          if (canUseDOM()) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data.data));
          }
          return data.data;
        }
      }
    } catch (error) {
      console.warn('Failed to load from API, falling back to localStorage:', error);
    }
  }
  
  // Fallback to localStorage
  try {
    if (!canUseDOM()) return DEFAULT_STORY;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORY;
    const parsed = JSON.parse(raw) as StorySections;
    return {
      individual: parsed.individual ?? DEFAULT_STORY.individual,
      advisors: parsed.advisors ?? DEFAULT_STORY.advisors,
      managers: parsed.managers ?? DEFAULT_STORY.managers,
      admins: parsed.admins ?? DEFAULT_STORY.admins,
    };
  } catch {
    return DEFAULT_STORY;
  }
}

/**
 * Save story to API and localStorage
 */
export async function saveStory(data: StorySections, projectId?: string): Promise<boolean> {
  // Save to localStorage first for immediate access
  if (canUseDOM()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  
  // If projectId is provided, also save to API
  if (projectId) {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/user-story-page/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          individual: data.individual,
          advisors: data.advisors,
          managers: data.managers,
          admins: data.admins,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.success;
      }
    } catch (error) {
      console.warn('Failed to save to API, data saved locally:', error);
      // Data is already saved to localStorage, so return true
      return true;
    }
  }
  
  return true; // Success for localStorage-only save
}

/**
 * Create new user story page via API
 */
export async function createStory(projectId: string, data: StorySections): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/user-story-page/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        individual: data.individual,
        advisors: data.advisors,
        managers: data.managers,
        admins: data.admins,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      // Also save to localStorage
      if (canUseDOM() && result.success) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      return result.success;
    }
    return false;
  } catch (error) {
    console.error('Error creating user stories:', error);
    return false;
  }
}

/**
 * Accept user story page
 */
export async function acceptStory(projectId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/user-story-page/accept/`, {
      method: 'POST',
    });

    if (response.ok) {
      const result = await response.json();
      return result.success;
    }
    return false;
  } catch (error) {
    console.error('Error accepting user stories:', error);
    return false;
  }
}

/**
 * Get user story page status
 */
export async function getStoryStatus(projectId: string): Promise<UserStoryPageStatus | null> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/user-story-page/status/`);
    
    if (response.ok) {
      const data = await response.json();
      return data.success ? data.data : null;
    }
    return null;
  } catch (error) {
    console.error('Error getting story status:', error);
    return null;
  }
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Parse story text into array of individual stories
 */
export function parseStoryText(text: string): string[] {
  return text.split('\n')
    .filter(line => line.trim())
    .map(line => line.replace(/^\d+\.\s*/, '').trim());
}

/**
 * Format array of stories into numbered text
 */
export function formatStoryText(stories: string[]): string {
  return stories.map((story, index) => `${index + 1}. ${story}`).join('\n');
}

/**
 * Check if stories are valid (not empty)
 */
export function hasValidStories(storyData: StorySections): boolean {
  const roles: (keyof StorySections)[] = ['individual', 'advisors', 'managers', 'admins'];
  return roles.some(role => {
    const stories = parseStoryText(storyData[role]);
    return stories.length > 0 && stories.some(story => story.length > 10);
  });
}

/**
 * Check if stories are different from default
 */
export function hasChanges(storyData: StorySections): boolean {
  return storyData.individual !== DEFAULT_STORY.individual ||
         storyData.advisors !== DEFAULT_STORY.advisors ||
         storyData.managers !== DEFAULT_STORY.managers ||
         storyData.admins !== DEFAULT_STORY.admins;
}

// ========== AI SUGGESTION FUNCTION (KEEP EXISTING) ==========

// Simple mock AI rewriter. If VITE_AI_ENDPOINT is present, it will try to POST there.
export async function requestAISuggestion(message: string, currentText: string): Promise<string> {
  const endpoint = (import.meta as any).env?.VITE_AI_ENDPOINT as string | undefined;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, content: currentText }),
      });
      if (res.ok) {
        const json = await res.json();
        return (json.suggestion as string) || currentText;
      }
    } catch {
      // fall through to mock below
    }
  }
  // Mock: quick grammar touch-ups and ensure trailing periods per line
  const lines = currentText.split(/\r?\n/).map((l) => l.trim());
  const fixed = lines
    .map((l) =>
      l
        .replace(/As a Individual/gi, "As an Individual")
        .replace(/As a Investment/gi, "As an Investment")
        .replace(/\s+so that\s+/gi, " so that ")
        .replace(/\s{2,}/g, " ")
    )
    .map((l) => (/[.!?]$/.test(l) ? l : `${l}.`));
  // Add a little hint it was updated based on the prompt
  return fixed.join("\n");
}