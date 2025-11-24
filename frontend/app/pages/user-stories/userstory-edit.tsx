import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { loadStory, saveStory, type StorySections, requestAISuggestion } from "./userstory-data";

type SectionKey = keyof StorySections;

export default function UserStoryEditPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<StorySections>({
    individual: "",
    advisors: "", 
    managers: "",
    admins: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("individual");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  // Load data asynchronously
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const storyData = await loadStory();
        setForm(storyData);
      } catch (error) {
        console.error("Failed to load user stories", error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveStory(form);
      navigate("/UserStoryPage");
    } catch (error) {
      console.error("Failed to save user stories", error);
    } finally {
      setSaving(false);
    }
  };

  const onAIEdit = async () => {
    if (!aiPrompt.trim()) return;
    
    setAiBusy(true);
    try {
      const currentText = form[activeSection];
      const suggestion = await requestAISuggestion(aiPrompt, currentText);
      
      setForm(prev => ({
        ...prev,
        [activeSection]: suggestion
      }));
      
      setAiMessages(prev => [
        ...prev,
        { role: "user" as const, content: aiPrompt },
        { role: "assistant" as const, content: suggestion }
      ]);
      setAiPrompt("");
    } catch (error) {
      console.error("AI suggestion failed", error);
    } finally {
      setAiBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="container mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          <div className="flex justify-center items-center py-12">
            <div className="text-lg">Loading user stories...</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <h1 className="mb-8 mt-4 text-4xl font-bold md:text-5xl">Edit User Story</h1>

        {/* Section Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Section:</label>
          <select 
            value={activeSection} 
            onChange={(e) => setActiveSection(e.target.value as SectionKey)}
            className="w-full p-2 border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="individual">Individual Users</option>
            <option value="advisors">Financial Advisors</option>
            <option value="managers">Investment Managers</option>
            <option value="admins">Administrators</option>
          </select>
        </div>

        {/* Text Area for Editing */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            {activeSection.replace(/\b\w/g, l => l.toUpperCase())} Stories:
          </label>
          <textarea
            value={form[activeSection]}
            onChange={(e) => setForm(prev => ({ ...prev, [activeSection]: e.target.value }))}
            rows={10}
            className="w-full p-3 border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-900"
            placeholder={`Enter user stories for ${activeSection}...`}
          />
        </div>

        {/* AI Assistant Section */}
        <div className="mb-6 p-4 border border-gray-300 rounded dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-2">AI Assistant</h3>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ask AI to improve, rewrite, or generate stories..."
              className="flex-1 p-2 border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-900"
              disabled={aiBusy}
            />
            <button
              onClick={onAIEdit}
              disabled={aiBusy || !aiPrompt.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              {aiBusy ? "Processing..." : "Ask AI"}
            </button>
          </div>
          {aiMessages.length > 0 && (
            <div className="mt-4 space-y-2">
              {aiMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`p-2 rounded ${
                    msg.role === 'user' 
                      ? 'bg-blue-100 dark:bg-blue-900' 
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <strong className="capitalize">{msg.role}:</strong> 
                  <div className="mt-1">{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pb-6">
          <button
            onClick={() => navigate("/UserStoryPage")}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}