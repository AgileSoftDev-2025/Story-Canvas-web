// routes/hasilgenerate.tsx - CODE LENGKAP + DEBUG
import React, { useState, useEffect } from "react";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { useNavigate, useParams } from "react-router-dom";
import type { Scenario, ProjectScenarioResponse } from "../../services/scenarioServices";
import { scenarioService } from "../../services/scenarioServices";

export default function HasilGenerate() {
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  
  // 🔴 DEBUG: Cek apakah component ter-render dengan projectId yang benar
  console.log("🎯 [COMPONENT RENDER] HasilGenerate mounted");
  console.log("🎯 [COMPONENT RENDER] projectId from useParams:", projectId);
  console.log("🎯 [COMPONENT RENDER] useParams():", useParams());
  
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("");

  // Fetch scenarios from API
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

  // ... (rest of your component code - formatScenariosContent, handleGenerateNew, etc.)
  // Tetap sama seperti code asli Anda

  return (
    <div className="flex flex-col min-h-screen bg-[#f9fafb]">
      <Header />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto bg-white shadow-md rounded-xl p-6">
          
          {/* 🔴 DEBUG SECTION */}
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
            <h3 className="font-bold text-yellow-800">🔴 DEBUG MODE - API TEST</h3>
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
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-[#3E4766]">
                {projectTitle}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Project ID: {projectId}
              </p>
            </div>
          </div>

          {/* Content area */}
          <div className="whitespace-pre-wrap text-gray-700 font-mono text-sm bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-[500px]">
            {loading ? "Loading scenarios..." : 
             error ? `Error: ${error}` :
             scenarios.length === 0 ? "No scenarios available. Please generate scenarios first." :
             `Found ${scenarios.length} scenarios for project ${projectTitle}`}
          </div>

          <div className="flex justify-between items-center mt-6">
            <button
              onClick={fetchProjectScenarios}
              className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-5 py-2 text-white font-medium shadow-sm hover:opacity-95"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}