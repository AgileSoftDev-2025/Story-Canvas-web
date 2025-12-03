// app/pages/HasilGenerate.tsx
import React, { useState, useEffect } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate, useParams } from "react-router-dom";

// Import service dan types
import type { Scenario, ProjectScenarioResponse, GenerateProjectScenarioResponse, AcceptProjectScenarioResponse } from "../../services/scenarioServices";
import { scenarioService } from "../../services/scenarioServices";

export default function HasilGenerate() {
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  
  // 🔴 DEBUG: Cek apakah component ter-render
  console.log("🎯 [COMPONENT RENDER] HasilGenerate mounted");
  console.log("🎯 [COMPONENT RENDER] projectId from useParams:", projectId);
  console.log("🎯 [COMPONENT RENDER] useParams():", useParams());
  
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("");

  // === Tambahan fitur Bantuan AI ===
  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // Fetch scenarios from API - BERDASARKAN PROJECT ID
  useEffect(() => {
    console.log("🔍 [USE_EFFECT] useEffect triggered");
    console.log("🔍 [USE_EFFECT] projectId:", projectId);
    
    if (projectId && projectId !== "undefined") {
      console.log("🚀 [USE_EFFECT] Calling fetchProjectScenarios");
      fetchProjectScenarios();
    } else {
      console.log("❌ [USE_EFFECT] No valid projectId found:", projectId);
      setError("No project ID provided");
      setLoading(false);
    }
  }, [projectId]);

  const fetchProjectScenarios = async (): Promise<void> => {
    try {
      console.log("🔄 [FETCH] Starting fetchProjectScenarios");
      setLoading(true);
      setError(null);
      
      if (!projectId) {
        console.log("❌ [FETCH] projectId is null/undefined");
        setError("No project ID provided");
        return;
      }
      
      console.log("📡 [FETCH] Calling scenarioService.getProjectScenarios with:", projectId);
      
      const result = await scenarioService.getProjectScenarios(projectId);
      console.log("✅ [FETCH] Service result received:", result);
      console.log("✅ [FETCH] Result success:", result.success);
      console.log("✅ [FETCH] Scenarios count:", result.scenarios?.length);
      
      if (result.success) {
        const scenariosData = result.scenarios || [];
        const projectTitle = result.project_title || "Project Scenarios";
        
        console.log("📋 [FETCH] Scenarios data:", scenariosData);
        console.log("🏷️ [FETCH] Project title:", projectTitle);
        
        setScenarios(scenariosData);
        setProjectTitle(projectTitle);
        console.log("✅ [FETCH] State updated successfully");
      } else {
        console.log("❌ [FETCH] Service error:", result.error);
        setError(result.error || 'Failed to load scenarios');
      }
    } catch (err: unknown) {
      console.error("💥 [FETCH] Catch error:", err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scenarios';
      
      if (err instanceof Error) {
        console.log("💥 [FETCH] Error name:", err.name);
        console.log("💥 [FETCH] Error message:", err.message);
        console.log("💥 [FETCH] Error stack:", err.stack);
      }
      
      setError(errorMessage);
    } finally {
      console.log("🔚 [FETCH] Setting loading to false");
      setLoading(false);
    }
  };

  // Format scenarios untuk ditampilkan
  const formatScenariosContent = (): string => {
    if (scenarios.length === 0) {
      return "No scenarios found for this project.";
    }

    let content = `Project: ${projectTitle}\n\n`;
    content += `Generated Scenarios (${scenarios.length}):\n\n`;
    
    scenarios.forEach((scenario, index) => {
      content += `=== Scenario ${index + 1} ===\n`;
      content += `Type: ${scenario.scenario_type || 'N/A'}\n`;
      content += `Title: ${scenario.title || 'N/A'}\n`;
      content += `Domain: ${scenario.detected_domain || 'N/A'}\n`;
      content += `Status: ${scenario.status || 'draft'}\n`;
      content += `Structure: ${scenario.has_proper_structure ? 'Proper' : 'Needs Improvement'}\n`;
      content += `Enhanced with LLM: ${scenario.enhanced_with_llm ? 'Yes' : 'No'}\n\n`;
      
      // Scenario text utama
      content += `Scenario:\n${scenario.scenario_text}\n\n`;
      
      // Gherkin steps jika ada
      if (scenario.gherkin_steps && scenario.gherkin_steps.length > 0) {
        content += `Gherkin Steps:\n`;
        scenario.gherkin_steps.forEach((step, stepIndex) => {
          content += `${stepIndex + 1}. ${step}\n`;
        });
        content += `\n`;
      }
      
      content += `---\n\n`;
    });

    return content;
  };

  const [content, setContent] = useState("");

  // Update content ketika scenarios berubah
  useEffect(() => {
    console.log("📝 [CONTENT EFFECT] Scenarios changed, updating content");
    console.log("📝 [CONTENT EFFECT] Scenarios length:", scenarios.length);
    
    if (scenarios.length > 0) {
      const formattedContent = formatScenariosContent();
      console.log("📝 [CONTENT EFFECT] Setting formatted content, length:", formattedContent.length);
      setContent(formattedContent);
    } else {
      console.log("📝 [CONTENT EFFECT] No scenarios, setting default message");
      setContent("No scenarios available. Please generate scenarios first.");
    }
  }, [scenarios, projectTitle]);

  // Fungsi untuk generate scenarios baru - BERDASARKAN PROJECT
  const handleGenerateNew = async (): Promise<void> => {
    try {
      console.log("🚀 [GENERATE] Starting generate new scenarios");
      setLoading(true);
      
      if (!projectId) {
        alert("No project ID provided");
        return;
      }
      
      console.log("🚀 [GENERATE] Generating new scenarios for project:", projectId);
      const result = await scenarioService.generateProjectScenarios(projectId);
      console.log("✅ [GENERATE] Generate result:", result);
      
      if (result.success) {
        alert(`✅ ${result.message}`);
        console.log("🔄 [GENERATE] Refresh scenarios after generation");
        await fetchProjectScenarios();
      } else {
        alert(`❌ Failed to generate scenarios: ${result.error}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error generating scenarios';
      console.log("💥 [GENERATE] Generate error:", err);
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (): Promise<void> => {
    try {
      console.log("✅ [ACCEPT] Starting accept scenarios");
      
      if (!projectId) {
        alert("No project ID provided");
        return;
      }
      
      if (scenarios.length === 0) {
        alert("No scenarios to accept");
        return;
      }
      
      const scenarioIds = scenarios.map(scenario => scenario.scenario_id);
      console.log("✅ [ACCEPT] Accepting scenarios:", scenarioIds);
      
      const result = await scenarioService.acceptProjectScenarios(projectId, scenarioIds);
      console.log("✅ [ACCEPT] Accept result:", result);
      
      if (result.success) {
        alert(`✅ ${result.message}`);
        navigate("/PreviewFinal");
      } else {
        alert(`❌ Failed to accept scenarios: ${result.error}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error accepting scenarios';
      console.log("💥 [ACCEPT] Accept error:", err);
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleSaveEdit = async (): Promise<void> => {
    try {
      console.log("💾 [SAVE] Saving edits");
      setIsEditing(false);
      alert("✅ Edit mode disabled for now. Changes are local only.");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error saving scenarios';
      alert(errorMessage);
    }
  };

  const sendToAI = async () => {
    if (!aiInput.trim()) return;
    const msg = aiInput.trim();
    console.log("🤖 [AI] Sending message:", msg);
    setAiMessages((m) => [...m, { role: "user", content: msg }]);
    setAiBusy(true);

    try {
      setTimeout(() => {
        const response =
          "AI Suggestion: Consider adding validation scenarios for edge cases and error handling to improve test coverage.";
        console.log("🤖 [AI] Received response:", response);
        setAiMessages((m) => [...m, { role: "assistant", content: response }]);
        setAiBusy(false);
        setAiInput("");
      }, 1000);
    } catch (err) {
      setAiBusy(false);
      alert("Error connecting to AI service");
    }
  };

  const applyLastSuggestion = () => {
    const last = [...aiMessages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    console.log("🤖 [AI] Applying suggestion:", last.content);
    setContent((prev) => prev + "\n\n" + last.content);
    setShowAI(false);
  };

  // Loading state
  if (loading) {
    console.log("⏳ [RENDER] Loading state");
    return (
      <div className="flex flex-col min-h-screen bg-[#f9fafb]">
        <Header />
        <main className="flex-1 px-6 py-10">
          <div className="max-w-5xl mx-auto bg-white shadow-md rounded-xl p-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-gray-600">Loading scenarios...</div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error) {
    console.log("❌ [RENDER] Error state:", error);
    return (
      <div className="flex flex-col min-h-screen bg-[#f9fafb]">
        <Header />
        <main className="flex-1 px-6 py-10">
          <div className="max-w-5xl mx-auto bg-white shadow-md rounded-xl p-6">
            <div className="flex flex-col items-center justify-center h-64">
              <div className="text-red-500 text-lg mb-4 text-center">
                <div className="font-semibold">Error Loading Scenarios</div>
                <div className="text-sm mt-2">{error}</div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={fetchProjectScenarios}
                  className="rounded-lg bg-blue-500 px-6 py-2 text-white font-medium hover:bg-blue-600 transition"
                >
                  Try Again
                </button>
                <button
                  onClick={handleGenerateNew}
                  className="rounded-lg bg-green-500 px-6 py-2 text-white font-medium hover:bg-green-600 transition"
                >
                  Generate New
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  console.log("✅ [RENDER] Main render, scenarios:", scenarios.length);
  
  return (
    <div className="flex flex-col min-h-screen bg-[#f9fafb]">
      <Header />

      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto bg-white shadow-md rounded-xl p-6">
          
          {/* 🔴 DEBUG SECTION - HAPUS SETELAH TEST */}
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
            <h3 className="font-bold text-yellow-800">🔴 DEBUG MODE</h3>
            <div className="mt-2 space-y-2 text-sm">
              <p><strong>Project ID:</strong> {projectId || 'NULL'}</p>
              <p><strong>Loading:</strong> {loading ? 'true' : 'false'}</p>
              <p><strong>Scenarios count:</strong> {scenarios.length}</p>
              <p><strong>Error:</strong> {error || 'None'}</p>
              <p><strong>Project Title:</strong> {projectTitle}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => {
                  console.log("🧪 [MANUAL TEST] Manual fetch triggered");
                  fetchProjectScenarios();
                }}
                className="bg-red-500 text-white px-4 py-2 rounded text-sm"
              >
                🧪 TEST FETCH MANUALLY
              </button>
              <button 
                onClick={() => {
                  console.log("🔄 [MANUAL TEST] Checking current state");
                  console.log("Current scenarios:", scenarios);
                  console.log("Current projectId:", projectId);
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded text-sm"
              >
                🔍 CHECK STATE
              </button>
            </div>
          </div>
          {/* 🔴 END DEBUG SECTION */}

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-[#3E4766]">
                {projectTitle}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Project ID: {projectId}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAI(true)}
                className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
              >
                Butuh bantuan AI?
              </button>
              {scenarios.length > 0 && (
                <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
                  {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Info Panel */}
          {scenarios.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex flex-wrap gap-4 text-sm text-blue-800">
                <div>
                  <span className="font-medium">Total Scenarios:</span> {scenarios.length}
                </div>
                <div>
                  <span className="font-medium">Main Scenarios:</span> {scenarios.filter(s => s.scenario_type === 'main_success').length}
                </div>
                <div>
                  <span className="font-medium">Alternative:</span> {scenarios.filter(s => s.scenario_type === 'alternative').length}
                </div>
                <div>
                  <span className="font-medium">Edge Cases:</span> {scenarios.filter(s => s.scenario_type === 'edge_case').length}
                </div>
              </div>
            </div>
          )}

          {/* Editable Section */}
          {isEditing ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-[500px] border border-gray-300 rounded-lg p-4 text-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#5561AA]"
            />
          ) : (
            <div className="whitespace-pre-wrap text-gray-700 font-mono text-sm bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-[500px]">
              {content || "No scenarios available."}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-between items-center mt-6">
            <div className="flex gap-3">
              <button
                onClick={handleGenerateNew}
                className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-5 py-2 text-white font-medium shadow-sm hover:opacity-95"
              >
                Generate New
              </button>
            </div>

            <div className="flex gap-3">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg px-5 py-2 font-medium
                              text-[#5561AA] bg-white border-2 border-[#5561AA]
                              hover:bg-gray-100 transition-colors shadow-sm"
                >
                  Edit
                </button>
              ) : (
                <button
                  onClick={handleSaveEdit}
                  className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-5 py-2 text-white font-medium shadow-sm hover:opacity-95"
                >
                  Save
                </button>
              )}

              <button
                onClick={handleAccept}
                disabled={scenarios.length === 0}
                className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-5 py-2 text-white font-medium shadow-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept {scenarios.length > 0 ? `(${scenarios.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Popup Bantuan AI */}
      {showAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Butuh bantuan AI?</h3>
              <button
                onClick={() => setShowAI(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Instruksi
              </label>
              <div className="flex gap-2">
                <input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Contoh: perbaiki grammar atau ringkas kalimat."
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5561AA]"
                />
                <button
                  onClick={sendToAI}
                  disabled={aiBusy}
                  className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {aiBusy ? "Memproses..." : "Kirim"}
                </button>
              </div>
            </div>

            <div className="mb-3 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {aiMessages.length === 0 ? (
                <p className="text-gray-500">
                  Kirim instruksi untuk mendapatkan saran AI. Saran terakhir bisa diterapkan ke editor.
                </p>
              ) : (
                <ul className="space-y-3">
                  {aiMessages.map((m, i) => (
                    <li
                      key={i}
                      className={
                        m.role === "user"
                          ? "text-gray-800"
                          : "text-green-700"
                      }
                    >
                      <span className="mr-2 rounded bg-gray-100 px-2 py-0.5 text-xs">
                        {m.role}
                      </span>
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAI(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#4699DF] hover:bg-gray-100"
              >
                Tutup
              </button>
              <button
                onClick={applyLastSuggestion}
                disabled={!aiMessages.some((m) => m.role === "assistant")}
                className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                Terapkan ke Editor
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}