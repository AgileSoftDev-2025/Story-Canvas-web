// frontend/src/routes/preview.tsx
import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";

export default function PreviewFinal() {
  const [activeTab, setActiveTab] = useState<"stories" | "wireframes" | "scenarios">("stories");
  const [exportSelection, setExportSelection] = useState({
    userStories: true,
    wireframes: true,
    scenarios: true,
  });

  // Sample data - replace with actual data from your state management
  const projectTitle = "Financial Management System";

  const userStories = [
    {
      role: "Individual Users",
      stories: [
        "As a Individual Users, I want to link my bank accounts so that the system can automatically track and categorize my transactions",
        "As a Individual Users, I need to receive AI-driven budgeting recommendations so that I can better manage my finances",
        "As a Individual Users, I should be able to get personalized investment portfolio suggestions so that I can make informed investment decisions",
      ],
    },
    {
      role: "Financial Advisors",
      stories: [
        "As a Financial Advisors, I want to review my clients' personalized investment portfolio suggestions so that I can provide tailored advice and recommendations.",
        "As a Financial Advisors, I need to access real-time stock and crypto tracking data to stay informed about my clients' investments and market trends so that I can make timely and informed decisions.",
        "As a Financial Advisors, I should be able to monitor my clients' portfolio performance and receive risk analysis alerts so that I can proactively address any potential issues and adjust their investment strategies.",
      ],
    },
  ];

  const wireframes = [
    { id: 1, name: "Wireframe Page A", image: "/wireframe-a.png" },
    { id: 2, name: "Wireframe Page B", image: "/wireframe-b.png" },
    { id: 3, name: "Wireframe Page C", image: "/wireframe-c.png" },
  ];

  const scenarios = [
    {
      story: "Individual Users_story_1",
      scenarios: [
        {
          title: "Scenario 1: link my bank accounts when HTML structure is missing or malformed",
          steps: [
            "Given the individual users is on the related HTML page",
            "But the system could not detect expected UI elements",
            "When the individual users tries to perform link my bank accounts",
            "Then the system should handle gracefully",
            "And provide explicit fallbacks, default components, or instructions to the user",
          ],
        },
        {
          title: "Scenario 2: Successful link my bank accounts",
          steps: [
            "Given the individual users is on the related HTML page",
            "And the page is assumed to have: form fields, buttons, links",
            "When the individual users interacts correctly with form fields, buttons, links",
            "Then the system should complete link my bank accounts successfully",
            "And the individual users achieves the goal: the system can automatically track and categorize my transactions",
          ],
        },
      ],
    },
  ];

  // Handle export selection changes
  const handleExportSelectionChange = (type: keyof typeof exportSelection) => {
    setExportSelection((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Select all / deselect all
  const handleSelectAll = (select: boolean) => {
    setExportSelection({
      userStories: select,
      wireframes: select,
      scenarios: select,
    });
  };

  // Handle export logic
  const handleExport = () => {
    const selectedTypes = Object.entries(exportSelection)
      .filter(([_, selected]) => selected)
      .map(([type]) => type);

    if (selectedTypes.length === 0) {
      alert("Please select at least one item to export.");
      return;
    }

    console.log("Exporting selected items:", exportSelection);

    // Show confirmation with selected items
    const selectedItems = selectedTypes
      .join(", ")
      .replace(/([A-Z])/g, " $1")
      .toLowerCase();
    alert(`Exporting ${selectedItems} as ZIP file...`);

    // Here you would implement the actual export logic
    // For example: generateZip(exportSelection, projectData);
  };

  // Check if all items are selected
  const allSelected = Object.values(exportSelection).every(Boolean);
  const someSelected = Object.values(exportSelection).some(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <section className="flex-1 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Preview & Export</h1>
            <p className="text-lg text-gray-600">Project: {projectTitle}</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-8 border-b-2 border-gray-200">
            <button
              onClick={() => setActiveTab("stories")}
              className={`px-6 py-3 font-semibold text-base transition-all ${activeTab === "stories" ? "text-[#5F3D89] border-b-4 border-[#5F3D89] -mb-[2px]" : "text-gray-600 hover:text-gray-900"}`}
            >
              User Stories
            </button>
            <button
              onClick={() => setActiveTab("wireframes")}
              className={`px-6 py-3 font-semibold text-base transition-all ${activeTab === "wireframes" ? "text-[#5F3D89] border-b-4 border-[#5F3D89] -mb-[2px]" : "text-gray-600 hover:text-gray-900"}`}
            >
              Wireframes
            </button>
            <button
              onClick={() => setActiveTab("scenarios")}
              className={`px-6 py-3 font-semibold text-base transition-all ${activeTab === "scenarios" ? "text-[#5F3D89] border-b-4 border-[#5F3D89] -mb-[2px]" : "text-gray-600 hover:text-gray-900"}`}
            >
              Test Scenarios
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[500px]">
            {/* User Stories Tab */}
            {activeTab === "stories" && (
              <div className="space-y-8">
                {userStories.map((group, idx) => (
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
                ))}
              </div>
            )}

            {/* Wireframes Tab */}
            {activeTab === "wireframes" && (
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wireframes.map((wireframe) => (
                    <div key={wireframe.id} className="bg-white border-2 border-gray-300 rounded-2xl overflow-hidden hover:shadow-lg transition">
                      <div className="aspect-[3/4] bg-gray-200 flex items-center justify-center">
                        {/* Placeholder for wireframe image */}
                        <div className="text-center p-6">
                          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <p className="text-sm text-gray-500">{wireframe.name}</p>
                        </div>
                      </div>
                      <div className="p-4 bg-white">
                        <h3 className="font-semibold text-gray-900">{wireframe.name}</h3>
                        <button className="mt-2 text-sm text-[#5F3D89] hover:underline">View Full Size</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 border-l-4 border-[#5F3D89] p-4 rounded">
                  <p className="text-sm text-gray-700">
                    <strong>Note:</strong> All wireframes are generated as PNG files and included in the export package.
                  </p>
                </div>
              </div>
            )}

            {/* Test Scenarios Tab */}
            {activeTab === "scenarios" && (
              <div className="space-y-8">
                {scenarios.map((storyScenarios, idx) => (
                  <div key={idx} className="space-y-4">
                    <h2 className="text-2xl font-bold text-gray-900">{storyScenarios.story}</h2>
                    {storyScenarios.scenarios.map((scenario, scenarioIdx) => (
                      <div key={scenarioIdx} className="bg-white border-2 border-gray-300 rounded-2xl p-6 space-y-3">
                        <h3 className="font-semibold text-lg text-gray-900">{scenario.title}</h3>
                        <div className="pl-4 space-y-2 text-sm text-gray-800 leading-relaxed">
                          {scenario.steps.map((step, stepIdx) => (
                            <p key={stepIdx}>{step}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export Selection Section */}
          <div className="mt-12 pt-8 border-t-2 border-gray-200">
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Select Export Content</h3>

              {/* Select All Controls */}
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

              {/* Export Options */}
              <div className="grid md:grid-cols-3 gap-4">
                {/* User Stories Option */}
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

                {/* Wireframes Option */}
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

                {/* Test Scenarios Option */}
                <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${exportSelection.scenarios ? "border-[#5F3D89] bg-purple-50" : "border-gray-300 bg-white"}`} onClick={() => handleExportSelectionChange("scenarios")}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">Test Scenarios</h4>
                    <input type="checkbox" checked={exportSelection.scenarios} onChange={() => handleExportSelectionChange("scenarios")} className="w-5 h-5 text-[#5F3D89] rounded focus:ring-[#5F3D89]" />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Export all test scenarios as Gherkin files</p>
                  <div className="text-xs text-gray-500">
                    <span className="font-semibold">Includes:</span> {scenarios.reduce((acc, story) => acc + story.scenarios.length, 0)} scenarios
                  </div>
                </div>
              </div>

              {/* Selection Summary */}
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

            {/* Export Actions */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">Ready to Export?</h3>
                <p className="text-gray-600">{someSelected ? "Download your selected documentation in a single ZIP package." : "Select the items you want to export above."}</p>
              </div>
              <div className="flex space-x-4">
                <button onClick={() => window.history.back()} className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold text-base hover:bg-gray-50 transition">
                  Go Back
                </button>
                <button
                  onClick={handleExport}
                  disabled={!someSelected}
                  className={`px-8 py-4 rounded-lg font-semibold text-base transition shadow-lg flex items-center space-x-2 ${someSelected ? "bg-[#5F3D89] text-white hover:bg-opacity-90" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export as ZIP</span>
                </button>
              </div>
            </div>
          </div>

          {/* File Structure Info */}
          <div className="mt-8 bg-gray-50 rounded-xl p-6">
            <h4 className="font-bold text-gray-900 mb-4">Export Package Structure:</h4>
            <div className="font-mono text-sm text-gray-700 space-y-1">
              <div>📁 {projectTitle.replace(/\s+/g, "_")}/</div>
              {exportSelection.userStories && <div className="pl-6">📄 user_stories.md</div>}
              {exportSelection.wireframes && (
                <>
                  <div className="pl-6">📁 wireframes/</div>
                  {wireframes.map((wf) => (
                    <div key={wf.id} className="pl-12">
                      🖼️ {wf.name.toLowerCase().replace(/\s+/g, "_")}.png
                    </div>
                  ))}
                </>
              )}
              {exportSelection.scenarios && (
                <>
                  <div className="pl-6">📁 test_scenarios/</div>
                  {scenarios.map((scenario, idx) => (
                    <div key={idx} className="pl-12">
                      📄 {scenario.story.toLowerCase().replace(/\s+/g, "_")}.feature
                    </div>
                  ))}
                </>
              )}
              <div className="pl-6">📄 README.md</div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
