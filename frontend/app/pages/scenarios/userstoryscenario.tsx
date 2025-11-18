// src/pages/scenarios/userstoryscenario.tsx
import React, { useState, useEffect } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate, useParams } from "react-router-dom";
import type { Scenario } from "../../../services/scenarioServices";
import { scenarioService } from "../../../services/scenarioServices";

const UserStoryScenario: React.FC = () => {
  const navigate = useNavigate();
  const { storyId } = useParams<{ storyId: string }>();
  
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [accepting, setAccepting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState<string>("Individual Users");

  // Fetch scenarios from API
  useEffect(() => {
    if (storyId) {
      fetchStoryScenarios();
    } else {
      setError("No story ID provided");
      setLoading(false);
    }
  }, [storyId]);

  const fetchStoryScenarios = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      if (!storyId) {
        setError("No story ID provided");
        return;
      }
      
      const result = await scenarioService.getStoryScenarios(storyId);
      
      if (result.success) {
        setScenarios(result.scenarios || []);
        setStoryTitle(result.story_title || "Individual Users");
      } else {
        setError(result.error || 'Failed to load scenarios');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scenarios';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateScenarios = async (): Promise<void> => {
    try {
      setGenerating(true);
      
      if (!storyId) {
        alert("No story ID provided");
        return;
      }
      
      const result = await scenarioService.generateScenarios(storyId);
      
      if (result.success) {
        await fetchStoryScenarios();
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ Failed to generate scenarios: ${result.error}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error generating scenarios';
      alert(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async (): Promise<void> => {
    try {
      setAccepting(true);
      
      if (!storyId) {
        alert("No story ID provided");
        return;
      }
      
      const scenarioIds = scenarios.map(scenario => scenario.scenario_id);
      const result = await scenarioService.acceptScenarios(storyId, scenarioIds);
      
      if (result.success) {
        alert(`✅ ${result.message}`);
        navigate("/Export");
      } else {
        alert(`❌ Failed to accept scenarios: ${result.error}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error accepting scenarios';
      alert(errorMessage);
    } finally {
      setAccepting(false);
    }
  };

  const handleEdit = (): void => {
    if (!storyId) return;
    navigate(`/UserStoryScenarioEdit/${storyId}`);
  };

  const handleRetry = (): void => {
    fetchStoryScenarios();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="container mx-auto w-full max-w-4xl flex-1 px-6 py-8">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <div className="text-lg text-gray-600">Loading scenarios...</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="container mx-auto w-full max-w-4xl flex-1 px-6 py-8">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-red-500 text-lg mb-4 text-center">
              <div className="font-semibold">Error Loading Scenarios</div>
              <div className="text-sm mt-2">{error}</div>
            </div>
            <button
              onClick={handleRetry}
              className="rounded-lg bg-blue-500 px-6 py-2 text-white font-medium hover:bg-blue-600 transition"
            >
              Try Again
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const acceptedCount = scenarios.filter(s => s.status === 'accepted').length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold md:text-5xl">
            User Story Scenario
          </h1>
          <button
            onClick={handleGenerateScenarios}
            disabled={generating || loading}
            className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-2 font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </span>
            ) : (
              "Generate Scenarios"
            )}
          </button>
        </div>

        <section className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">Story Details</h2>
            <div className="text-sm text-gray-500">
              Story ID: {storyId}
            </div>
          </div>
          <p className="mb-5 text-gray-600 dark:text-gray-300">
            {storyTitle} (Individual Users)
          </p>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {scenarios.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg mb-4">
                  No scenarios found for this story
                </div>
                <button
                  onClick={handleGenerateScenarios}
                  disabled={generating}
                  className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {generating ? "Generating..." : "Generate Scenarios"}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-600">
                    Found {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-green-600 font-medium">
                    {acceptedCount} accepted
                  </div>
                </div>
                
                <div className="flex flex-col gap-4 whitespace-pre-line text-gray-800 dark:text-gray-200 overflow-y-auto max-h-[70vh] px-2">
                  {scenarios.map((scenario, index) => (
                    <div
                      key={scenario.scenario_id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {scenario.scenario_type ? 
                              scenario.scenario_type.replace('_', ' ').toUpperCase() : 
                              `Scenario ${index + 1}`
                            }
                          </span>
                          {scenario.title && (
                            <span className="text-sm text-gray-500">- {scenario.title}</span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          scenario.status === 'accepted' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {scenario.status || 'draft'}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm bg-white dark:bg-gray-900 p-3 rounded border">
                        {scenario.scenario_text}
                      </pre>
                      {scenario.detected_domain && (
                        <div className="mt-2 text-xs text-gray-500">
                          Domain: {scenario.detected_domain}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="flex justify-between items-center pb-6">
          <div className="text-sm text-gray-500">
            Story ID: {storyId}
          </div>
          <div className="flex justify-end gap-4">
            <button
              onClick={handleEdit}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-[#4699DF] shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              Edit
            </button>
            <button
              onClick={handleAccept}
              disabled={scenarios.length === 0 || accepting}
              className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {accepting ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Accepting...
                </span>
              ) : (
                `Accept ${scenarios.length > 0 ? `(${scenarios.length})` : ''}`
              )}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default UserStoryScenario;