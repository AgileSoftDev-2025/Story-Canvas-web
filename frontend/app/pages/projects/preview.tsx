import React, { useState, useEffect } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { exportService, type ExportConfig, type ProjectData } from "../../services/exportService";

export default function PreviewFinal() {
  const [activeTab, setActiveTab] = useState<"stories" | "wireframes" | "scenarios">("stories");
  const [exportSelection, setExportSelection] = useState({
    userStories: true,
    wireframes: true,
    scenarios: true,
  });
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    console.group("🔍 PREVIEW COMPONENT MOUNT");
    console.log("📅 Component mounted at:", new Date().toISOString());

    const storedProjectId = localStorage.getItem("currentProjectId");
    console.log("📋 Stored project ID from localStorage:", storedProjectId);

    // Debug localStorage secara detail
    exportService.debugLocalStorage();

    // Test koneksi backend
    console.log("🧪 Testing backend connection...");
    exportService.testBackendConnection().then((success) => {
      console.log(success ? "✅ Backend is reachable" : "❌ Backend is not reachable");
    });

    if (storedProjectId) {
      console.log("🎯 Using project ID from localStorage:", storedProjectId);
      console.log("🔍 Project ID validation:", {
        isString: typeof storedProjectId === "string",
        length: storedProjectId.length,
        isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedProjectId),
      });

      setProjectId(storedProjectId);
      setDebugInfo(`Loading project: ${storedProjectId}`);
      loadProjectData(storedProjectId);
    } else {
      console.log("❌ No project ID found in localStorage");
      console.error(
        "Missing project ID. Available localStorage keys:",
        Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      );

      // 🔥 Fallback project ID
      const fallbackId = "6918ccf4-391b-4012-9fce-be89f5421dec";

      console.warn("⚠️ Using fallback project ID:", fallbackId);

      setProjectId(fallbackId);
      setDebugInfo(`Using fallback project: ${fallbackId}`);
      loadProjectData(fallbackId);

      // Opsional: kalau tetap mau kasih error message ke UI
      // setError("No stored project found. Using fallback project.");
    }

    setLoading(false);

    console.groupEnd();
  }, []);

  const loadProjectData = async (projectId: string) => {
    const loadId = Math.random().toString(36).substring(2, 9);
    console.group(`🚀 [${loadId}] LOAD PROJECT DATA: ${projectId}`);
    console.log("⏰ Load started at:", new Date().toISOString());

    try {
      setLoading(true);
      setError("");
      setDebugInfo(`Loading project data for: ${projectId}`);

      console.log("📞 Calling exportService.getExportPreview...");
      console.log("📊 Current state:", {
        loading: true,
        error: "",
        projectData: projectData ? "present" : "null",
      });

      const preview = await exportService.getExportPreview(projectId);

      console.log("✅ Backend response received:", {
        success: preview.success,
        hasData: !!preview.data,
        dataKeys: preview.data ? Object.keys(preview.data) : "no data",
      });

      if (preview.success) {
        setProjectData(preview.data);
        setDebugInfo(`Loaded: ${preview.data.title} (${projectId})`);

        console.log("📊 Project data set successfully");
        console.log("📈 Data overview:", {
          title: preview.data.title,
          domain: preview.data.domain,
          objective: preview.data.objective,
          stories: preview.data.user_stories?.length || 0,
          wireframes: preview.data.wireframes?.length || 0,
          scenarios: preview.data.scenarios?.length || 0,
        });

        // Validasi data
        if (!preview.data.user_stories) {
          console.warn("⚠️ user_stories is undefined");
        }
        if (!preview.data.wireframes) {
          console.warn("⚠️ wireframes is undefined");
        }
        if (!preview.data.scenarios) {
          console.warn("⚠️ scenarios is undefined");
        }
      } else {
        console.error("❌ Backend returned error in response:", preview.error);
        console.error("❌ Full error response:", preview);

        throw new Error(preview.error || "Failed to load data from backend");
      }
    } catch (error: any) {
      console.error(`💥 [${loadId}] loadProjectData failed:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });

      const errorMessage = `Failed to load project data: ${error.message}`;
      setError(errorMessage);
      setDebugInfo(`Error: ${error.message}`);

      // Log additional debug info
      console.error("🐛 Debug info:", {
        projectId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        online: navigator.onLine,
      });
    } finally {
      setLoading(false);
      console.log("🏁 Load completed, loading set to false");
      console.log("📊 Final state:", {
        loading: false,
        error: error || "none",
        projectData: projectData ? "present" : "null",
      });
      console.groupEnd();
    }
  };

  const handleExportSelectionChange = (type: keyof typeof exportSelection) => {
    console.log("🔘 Export selection changed:", type, "from", exportSelection[type], "to", !exportSelection[type]);
    setExportSelection((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleSelectAll = (select: boolean) => {
    console.log("🔘 Select all:", select);
    setExportSelection({
      userStories: select,
      wireframes: select,
      scenarios: select,
    });
  };

  const handleExport = async () => {
    console.group("📤 HANDLE EXPORT");
    console.log("⚙️ Export starting...", {
      projectId,
      hasProjectData: !!projectData,
      exportSelection,
      exporting,
    });

    if (!projectId) {
      console.error("❌ No project ID");
      alert("No project selected");
      console.groupEnd();
      return;
    }

    if (!projectData) {
      console.error("❌ No project data");
      alert("No project data available");
      console.groupEnd();
      return;
    }

    const selectedTypes = Object.entries(exportSelection)
      .filter(([_, selected]) => selected)
      .map(([type]) => type);

    console.log("📋 Selected types for export:", selectedTypes);

    if (selectedTypes.length === 0) {
      console.warn("⚠️ No types selected for export");
      alert("Please select at least one item to export.");
      console.groupEnd();
      return;
    }

    try {
      setExporting(true);
      console.log("🔄 Exporting state set to true");

      const exportConfig: ExportConfig = {
        include_stories: exportSelection.userStories,
        include_wireframes: exportSelection.wireframes,
        include_scenarios: exportSelection.scenarios,
        format: "zip",
      };

      console.log("📦 Starting export with config:", exportConfig);
      console.log("🎯 Project details:", {
        title: projectData.title,
        stories: projectData.user_stories?.length || 0,
        wireframes: projectData.wireframes?.length || 0,
        scenarios: projectData.scenarios?.length || 0,
      });

      const blob = await exportService.exportProject(projectId, exportConfig);
      const fileName = `${projectData.title.replace(/\s+/g, "_")}_export.zip`;

      console.log("✅ Export completed, downloading file:", fileName);
      console.log("📦 Blob details:", {
        size: blob.size,
        type: blob.type,
      });

      exportService.downloadFile(blob, fileName);
      alert("✅ Export completed successfully!");
    } catch (error: any) {
      console.error("💥 Export failed:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      alert(`❌ Export failed: ${error.message}`);
    } finally {
      setExporting(false);
      console.log("🔄 Exporting state set to false");
      console.groupEnd();
    }
  };

  const formatStoriesData = (stories: any[]) => {
    console.log("📝 Formatting stories data:", {
      inputLength: stories?.length || 0,
      inputType: typeof stories,
    });

    if (!stories || !Array.isArray(stories)) {
      console.warn("⚠️ Invalid stories data:", stories);
      return [];
    }

    const grouped: { [key: string]: string[] } = {};

    stories.forEach((story, index) => {
      const role = story.role || "General";
      if (!grouped[role]) {
        grouped[role] = [];
      }
      const storyText = `As a ${story.role}, ${story.action} so that ${story.benefit}`;
      grouped[role].push(storyText);

      console.log(`📖 Story ${index}:`, {
        role: story.role,
        action: story.action,
        benefit: story.benefit,
        formatted: storyText,
      });
    });

    const result = Object.entries(grouped).map(([role, stories]) => ({
      role,
      stories,
    }));

    console.log("📊 Formatted stories result:", {
      groupCount: result.length,
      totalStories: result.reduce((acc, group) => acc + group.stories.length, 0),
      groups: result.map((g) => ({ role: g.role, count: g.stories.length })),
    });

    return result;
  };

  // Debug info component
  const DebugPanel = () => (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <div className="font-mono">
        <div>
          <strong>Debug Info:</strong>
        </div>
        <div>Project ID: {projectId || "none"}</div>
        <div>Loading: {loading ? "true" : "false"}</div>
        <div>Exporting: {exporting ? "true" : "false"}</div>
        <div>Error: {error || "none"}</div>
        <div>Data: {projectData ? "loaded" : "null"}</div>
        <div className="mt-2">{debugInfo}</div>
      </div>
    </div>
  );

  if (loading) {
    console.log("🔄 Rendering loading state");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading project data...</div>
        <DebugPanel />
      </div>
    );
  }

  if (error || !projectData) {
    console.log("❌ Rendering error state:", { error, hasProjectData: !!projectData });
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <section className="flex-1 py-12 bg-white">
          <div className="max-w-7xl mx-auto px-8">
            <div className="text-center py-12">
              <div className="text-red-600 text-lg mb-4">{error || "Failed to load project data"}</div>
              <div className="bg-gray-100 p-4 rounded-lg text-left max-w-2xl mx-auto mb-6">
                <h3 className="font-semibold mb-2">Debug Information:</h3>
                <div className="text-sm font-mono">
                  <div>Project ID: {projectId || "Not set"}</div>
                  <div>Error: {error || "Unknown error"}</div>
                  <div>Time: {new Date().toISOString()}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  console.log("🔄 Retrying load...");
                  if (projectId) {
                    loadProjectData(projectId);
                  } else {
                    window.history.back();
                  }
                }}
                className="px-6 py-3 bg-[#5F3D89] text-white rounded-lg hover:bg-opacity-90 transition mr-4"
              >
                Retry
              </button>
              <button onClick={() => window.history.back()} className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                Go Back to Projects
              </button>
            </div>
          </div>
        </section>
        <Footer />
        <DebugPanel />
      </div>
    );
  }

  console.log("✅ Rendering main preview interface");
  const userStories = formatStoriesData(projectData.user_stories || []);
  const wireframes = projectData.wireframes || [];
  const scenarios = projectData.scenarios || [];

  const allSelected = Object.values(exportSelection).every(Boolean);
  const someSelected = Object.values(exportSelection).some(Boolean);

  console.log("📊 Render data summary:", {
    stories: userStories.reduce((acc, group) => acc + group.stories.length, 0),
    wireframes: wireframes.length,
    scenarios: scenarios.length,
    exportSelection,
  });

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <section className="flex-1 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Preview & Export</h1>
            <p className="text-lg text-gray-600">Project: {projectData.title}</p>
            <p className="text-sm text-gray-500">Domain: {projectData.domain}</p>
            <p className="text-sm text-gray-500">Objective: {projectData.objective}</p>
            <p className="text-xs text-gray-400">ID: {projectData.project_id}</p>
          </div>

          <div className="flex space-x-1 mb-8 border-b-2 border-gray-200">
            <button
              onClick={() => {
                console.log("🔘 Switching to stories tab");
                setActiveTab("stories");
              }}
              className={`px-6 py-3 font-semibold text-base transition-all ${activeTab === "stories" ? "text-[#5F3D89] border-b-4 border-[#5F3D89] -mb-[2px]" : "text-gray-600 hover:text-gray-900"}`}
            >
              User Stories ({userStories.reduce((acc, group) => acc + group.stories.length, 0)})
            </button>
            <button
              onClick={() => {
                console.log("🔘 Switching to wireframes tab");
                setActiveTab("wireframes");
              }}
              className={`px-6 py-3 font-semibold text-base transition-all ${activeTab === "wireframes" ? "text-[#5F3D89] border-b-4 border-[#5F3D89] -mb-[2px]" : "text-gray-600 hover:text-gray-900"}`}
            >
              Wireframes ({wireframes.length})
            </button>
            <button
              onClick={() => {
                console.log("🔘 Switching to scenarios tab");
                setActiveTab("scenarios");
              }}
              className={`px-6 py-3 font-semibold text-base transition-all ${activeTab === "scenarios" ? "text-[#5F3D89] border-b-4 border-[#5F3D89] -mb-[2px]" : "text-gray-600 hover:text-gray-900"}`}
            >
              Test Scenarios ({scenarios.length})
            </button>
          </div>

          <div className="min-h-[500px]">
            {/* ... (rest of the JSX remains the same as your original) ... */}
            {activeTab === "stories" && (
              <div className="space-y-8">
                {userStories.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No user stories available</p>
                  </div>
                ) : (
                  userStories.map((group, idx) => (
                    <div key={idx} className="space-y-4">
                      <h2 className="text-2xl font-bold text-gray-900 underline">{group.role}</h2>
                      <div className="bg-white border-2 border-gray-300 rounded-2xl p-6">
                        <ol className="list-decimal list-inside space-y-3">
                          {group.stories.map((story, storyIdx) => (
                            <li key={storyIdx} className="text-base text-gray-800 leading-relaxed">
                              {story}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "wireframes" && (
              <div className="space-y-8">
                {wireframes.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No wireframes available</p>
                  </div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {wireframes.map((wireframe, index) => (
                        <div key={index} className="bg-white border-2 border-gray-300 rounded-2xl overflow-hidden hover:shadow-lg transition">
                          <div className="aspect-[3/4] bg-gray-200 flex items-center justify-center">
                            <div className="text-center p-6">
                              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <p className="text-sm text-gray-500">{wireframe.title || "Untitled Wireframe"}</p>
                            </div>
                          </div>
                          <div className="p-4 bg-white">
                            <h3 className="font-semibold text-gray-900">{wireframe.title || "Untitled Wireframe"}</h3>
                            <p className="text-sm text-gray-600 mt-1">{wireframe.description || "No description"}</p>
                            {wireframe.page_type && <p className="text-xs text-gray-500 mt-1">Type: {wireframe.page_type}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-blue-50 border-l-4 border-[#5F3D89] p-4 rounded">
                      <p className="text-sm text-gray-700">
                        <strong>Note:</strong> Wireframe descriptions are exported as TXT files in the export package.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "scenarios" && (
              <div className="space-y-8">
                {scenarios.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No test scenarios available</p>
                  </div>
                ) : (
                  scenarios.map((scenario, idx) => (
                    <div key={idx} className="space-y-4">
                      <h2 className="text-2xl font-bold text-gray-900">{scenario.title}</h2>
                      <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 space-y-3">
                        <h3 className="font-semibold text-lg text-gray-900">{scenario.title}</h3>
                        <p className="text-gray-700">{scenario.description}</p>
                        <div className="pl-4 space-y-2 text-sm text-gray-800 leading-relaxed">
                          {scenario.given_steps && scenario.given_steps.split("\n").map((step: string, stepIdx: number) => step.trim() && <p key={stepIdx}>Given {step.trim()}</p>)}
                          {scenario.when_steps && scenario.when_steps.split("\n").map((step: string, stepIdx: number) => step.trim() && <p key={stepIdx}>When {step.trim()}</p>)}
                          {scenario.then_steps && scenario.then_steps.split("\n").map((step: string, stepIdx: number) => step.trim() && <p key={stepIdx}>Then {step.trim()}</p>)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Export selection section */}
          <div className="mt-12 pt-8 border-t-2 border-gray-200">
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Select Export Content</h3>

              <div className="flex items-center justify-between mb-4 p-3 bg-white rounded-lg border border-gray-200">
                <span className="font-semibold text-gray-700">Select All</span>
                <div className="flex space-x-2">
                  <button onClick={() => handleSelectAll(true)} className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition">
                    Select All
                  </button>
                  <button onClick={() => handleSelectAll(false)} className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition">
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${exportSelection.userStories ? "border-[#5F3D89] bg-purple-50" : "border-gray-300 bg-white"}`}
                  onClick={() => handleExportSelectionChange("userStories")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">User Stories</h4>
                    <input type="checkbox" checked={exportSelection.userStories} onChange={() => handleExportSelectionChange("userStories")} className="w-5 h-5 text-[#5F3D89] rounded focus:ring-[#5F3D89]" />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Export all user stories as TXT file</p>
                  <div className="text-xs text-gray-500">
                    <span className="font-semibold">Includes:</span> {userStories.reduce((acc, group) => acc + group.stories.length, 0)} stories
                  </div>
                </div>

                <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${exportSelection.wireframes ? "border-[#5F3D89] bg-purple-50" : "border-gray-300 bg-white"}`} onClick={() => handleExportSelectionChange("wireframes")}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">Wireframes</h4>
                    <input type="checkbox" checked={exportSelection.wireframes} onChange={() => handleExportSelectionChange("wireframes")} className="w-5 h-5 text-[#5F3D89] rounded focus:ring-[#5F3D89]" />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Export wireframe descriptions as TXT file</p>
                  <div className="text-xs text-gray-500">
                    <span className="font-semibold">Includes:</span> {wireframes.length} wireframes
                  </div>
                </div>

                <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${exportSelection.scenarios ? "border-[#5F3D89] bg-purple-50" : "border-gray-300 bg-white"}`} onClick={() => handleExportSelectionChange("scenarios")}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">Test Scenarios</h4>
                    <input type="checkbox" checked={exportSelection.scenarios} onChange={() => handleExportSelectionChange("scenarios")} className="w-5 h-5 text-[#5F3D89] rounded focus:ring-[#5F3D89]" />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Export all test scenarios as Gherkin files</p>
                  <div className="text-xs text-gray-500">
                    <span className="font-semibold">Includes:</span> {scenarios.length} scenarios
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">
                  <strong>Selected for export:</strong>{" "}
                  {Object.entries(exportSelection)
                    .filter(([_, selected]) => selected)
                    .map(([type]) => type.replace(/([A-Z])/g, " $1").toLowerCase())
                    .join(", ") || "None"}
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">{exporting ? "Exporting..." : "Ready to Export?"}</h3>
                <p className="text-gray-600">{someSelected ? "Download your selected documentation in a single ZIP package." : "Select the items you want to export above."}</p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    console.log("🔙 Going back...");
                    window.history.back();
                  }}
                  className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold text-base hover:bg-gray-50 transition"
                  disabled={exporting}
                >
                  Go Back
                </button>
                <button
                  onClick={handleExport}
                  disabled={!someSelected || exporting}
                  className={`px-8 py-4 rounded-lg font-semibold text-base transition shadow-lg flex items-center space-x-2 ${
                    someSelected && !exporting ? "bg-[#5F3D89] text-white hover:bg-opacity-90" : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {exporting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Export as ZIP</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <DebugPanel />
    </div>
  );
}
