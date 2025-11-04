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

function canUseDOM() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadStory(): StorySections {
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

export function saveStory(data: StorySections) {
  if (!canUseDOM()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

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

