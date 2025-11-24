import React, { useState, useEffect } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { exportService, type ExportConfig, type FallbackProjectData } from "../../services/exportService";

// Gunakan interface yang sama dengan exportService
interface ProjectData extends FallbackProjectData {}

const FALLBACK_PROJECT_DATA: ProjectData = {
  project_id: "1aea2b0d-1c3a-400f-8c84-a1fa9d8c6758",
  title: "Sample E-Commerce Project",
  domain: "E-Commerce",
  objective: "Build a modern e-commerce platform",
  user_stories: [
    {
      id: 1,
      role: "Customer",
      action: "browse products",
      benefit: "I can find what I want to buy",
      acceptance_criteria: "Display products with images and prices",
      priority: "High",
      status: "Todo",
    },
    {
      id: 2,
      role: "Customer",
      action: "add items to cart",
      benefit: "I can purchase multiple items",
      acceptance_criteria: "Cart should update quantity and total",
      priority: "High",
      status: "Todo",
    },
    {
      id: 3,
      role: "Admin",
      action: "manage products",
      benefit: "I can keep inventory updated",
      acceptance_criteria: "CRUD operations for products",
      priority: "Medium",
      status: "Todo",
    },
  ],
  wireframes: [
    {
      id: 1,
      title: "Homepage",
      description: "Main landing page with product listings",
      page_type: "Landing",
      creole_content: "Header\nProduct Grid\nFooter",
    },
    {
      id: 2,
      title: "Product Detail",
      description: "Detailed product information page",
      page_type: "Detail",
      creole_content: "Product Image\nProduct Info\nAdd to Cart Button",
    },
  ],
  scenarios: [
    {
      id: 1,
      title: "Add to Cart",
      description: "User adds product to shopping cart",
      given_steps: "user is on product page\nproduct is in stock",
      when_steps: "user clicks add to cart button",
      then_steps: "cart count increases\nproduct appears in cart",
      scenario_type: "Happy Path",
    },
  ],
};

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
  const [useFallback, setUseFallback] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const storedProjectId = localStorage.getItem("currentProjectId");

    if (storedProjectId) {
      console.log("🎯 Using project ID from localStorage:", storedProjectId);
      setProjectId(storedProjectId);
      loadProjectData(storedProjectId);
    } else {
      console.log("⚠️ No project ID found, using fallback data");
      setProjectId("1aea2b0d-1c3a-400f-8c84-a1fa9d8c6758");
      setUseFallback(true);
      setProjectData(FALLBACK_PROJECT_DATA);
      setLoading(false);
    }
  }, []);

  const loadProjectData = async (projectId: string) => {
    try {
      setLoading(true);
      setError("");
      console.log("🚀 Loading project data from backend...");

      const preview = await exportService.getExportPreview(projectId, {
        include_stories: true,
        include_wireframes: true,
        include_scenarios: true,
      });

      console.log("✅ Backend response:", preview);

      if (preview.success) {
        setProjectData(preview.data);
        console.log("📊 Real data loaded successfully");
      } else {
        throw new Error(preview.error || "Failed to load data from backend");
      }
    } catch (error: any) {
      console.error("❌ Backend connection failed:", error);
      setError("Cannot connect to backend server. Using demo data.");
      setUseFallback(true);
      setProjectData(FALLBACK_PROJECT_DATA);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSelectionChange = (type: keyof typeof exportSelection) => {
    setExportSelection((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleSelectAll = (select: boolean) => {
    setExportSelection({
      userStories: select,
      wireframes: select,
      scenarios: select,
    });
  };

  const handleExport = async () => {
    if (!projectId) {
      alert("No project selected");
      return;
    }

    // Pastikan projectData tidak null
    if (!projectData) {
      alert("No project data available");
      return;
    }

    const selectedTypes = Object.entries(exportSelection)
      .filter(([_, selected]) => selected)
      .map(([type]) => type);

    if (selectedTypes.length === 0) {
      alert("Please select at least one item to export.");
      return;
    }

    try {
      setExporting(true);

      const exportConfig: ExportConfig = {
        include_stories: exportSelection.userStories,
        include_wireframes: exportSelection.wireframes,
        include_scenarios: exportSelection.scenarios,
        format: "zip",
      };

      console.log("📦 Starting export with config:", exportConfig);

      let blob: Blob;

      if (useFallback) {
        console.log("🔧 Using fallback export");
        // Gunakan non-null assertion karena kita sudah check !projectData di atas
        blob = await exportService.exportFallbackProject(projectData!, exportConfig);
      } else {
        console.log("🚀 Using backend export");
        // Use normal backend export
        blob = await exportService.exportProject(projectId, exportConfig);
      }

      const fileName = `${projectData.title.replace(/\s+/g, "_")}_export.zip`;

      exportService.downloadFile(blob, fileName);

      if (useFallback) {
        alert("✅ Demo export completed successfully! This was generated locally since backend is unavailable.");
      } else {
        alert("✅ Export completed successfully!");
      }
    } catch (error: any) {
      console.error("Export failed:", error);
      alert(`❌ Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const formatStoriesData = (stories: any[]) => {
    const grouped: { [key: string]: string[] } = {};

    stories.forEach((story) => {
      const role = story.role || "General";
      if (!grouped[role]) {
        grouped[role] = [];
      }
      grouped[role].push(`As a ${story.role}, ${story.action} so that ${story.benefit}`);
    });

    return Object.entries(grouped).map(([role, stories]) => ({
      role,
      stories,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading project data...</div>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">
          Failed to load project data
          {error && <div className="text-sm mt-2">{error}</div>}
        </div>
      </div>
    );
  }

  const userStories = formatStoriesData(projectData.user_stories || []);
  const wireframes = projectData.wireframes || [];
  const scenarios = projectData.scenarios || [];

  const allSelected = Object.values(exportSelection).every(Boolean);
  const someSelected = Object.values(exportSelection).some(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">❌</div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>Connection Issue:</strong> {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {useFallback && !error && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">🔧</div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Demo Mode:</strong> Showing sample data. Connect to backend for real project data.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="flex-1 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Preview & Export</h1>
            <p className="text-lg text-gray-600">Project: {projectData.title}</p>
            <p className="text-sm text-gray-500">Domain: {projectData.domain}</p>
            <p className="text-sm text-gray-500">Objective: {projectData.objective}</p>
            {useFallback && <p className="text-xs text-yellow-600">Using demo data - Project ID: {projectId}</p>}
          </div>

          <div className="flex space-x-1 mb-8 border-b-2 border-gray-200">
            <button
              onClick={() => setActiveTab("stories")}
              className={`px-6 py-3 font-semibold text-base transition-all ${activeTab === "stories" ? "text-[#5F3D89] border-b-4 border-[#5F3D89] -mb-[2px]" : "text-gray-600 hover:text-gray-900"}`}
            >
              User Stories ({userStories.reduce((acc, group) => acc + group.stories.length, 0)})
            </button>
            <button
              onClick={() => setActiveTab("wireframes")}
              className={`px-6 py-3 font-semibold text-base transition-all ${activeTab === "wireframes" ? "text-[#5F3D89] border-b-4 border-[#5F3D89] -mb-[2px]" : "text-gray-600 hover:text-gray-900"}`}
            >
              Wireframes ({wireframes.length})
            </button>
            <button
              onClick={() => setActiveTab("scenarios")}
              className={`px-6 py-3 font-semibold text-base transition-all ${activeTab === "scenarios" ? "text-[#5F3D89] border-b-4 border-[#5F3D89] -mb-[2px]" : "text-gray-600 hover:text-gray-900"}`}
            >
              Test Scenarios ({scenarios.length})
            </button>
          </div>

          <div className="min-h-[500px]">
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
                        <strong>Note:</strong> All wireframes are generated as PNG files and included in the export package.
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
                  <p className="text-sm text-gray-600 mb-2">Export all user stories as Markdown file</p>
                  <div className="text-xs text-gray-500">
                    <span className="font-semibold">Includes:</span> {userStories.reduce((acc, group) => acc + group.stories.length, 0)} stories
                  </div>
                </div>

                <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${exportSelection.wireframes ? "border-[#5F3D89] bg-purple-50" : "border-gray-300 bg-white"}`} onClick={() => handleExportSelectionChange("wireframes")}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">Wireframes</h4>
                    <input type="checkbox" checked={exportSelection.wireframes} onChange={() => handleExportSelectionChange("wireframes")} className="w-5 h-5 text-[#5F3D89] rounded focus:ring-[#5F3D89]" />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Export all wireframes as PNG files</p>
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
                {useFallback && <p className="text-sm text-yellow-600">⚠️ Real export requires backend connection</p>}
              </div>
              <div className="flex space-x-4">
                <button onClick={() => window.history.back()} className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold text-base hover:bg-gray-50 transition" disabled={exporting}>
                  Go Back
                </button>
                <button
                  onClick={handleExport}
                  disabled={!someSelected || exporting}
                  className={`px-8 py-4 rounded-lg font-semibold text-base transition shadow-lg flex items-center space-x-2 ${
                    someSelected && !exporting ? (useFallback ? "bg-yellow-600 text-white hover:bg-yellow-700" : "bg-[#5F3D89] text-white hover:bg-opacity-90") : "bg-gray-300 text-gray-500 cursor-not-allowed"
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
                      <span>{useFallback ? "Export Demo (Local)" : "Export as ZIP"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
