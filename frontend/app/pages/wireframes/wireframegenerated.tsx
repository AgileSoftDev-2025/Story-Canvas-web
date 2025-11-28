import React, { useEffect, useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate, useParams } from "react-router-dom";
import { localStorageService } from "../../utils/localStorageService";
import type { LocalProject, LocalWireframe } from "../../utils/localStorageModels";
import { useAuth } from "../../context/AuthContext";
import { WireframeService } from "../../services/WireframeService";

interface EnhancedWireframe extends LocalWireframe {
  display_data?: {
    page_name: string;
    page_type: string;
    html_preview: string;
    has_valid_structure: boolean;
    stories_count: number;
    features_count: number;
    generated_at: string;
    debug_status: string;
    llm_response_preview: string;
    llm_response_length: number;
    html_length: number;
    used_rag: boolean;
    used_fallback: boolean;
    generation_error?: string;
    ui_patterns_used: number;
    project_patterns_used: number;
  };
  full_llm_response?: string;
}

export default function WireframeGenerated() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user, isAuthenticated } = useAuth();

  const [wireframes, setWireframes] = useState<EnhancedWireframe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [project, setProject] = useState<LocalProject | null>(null);
  const [selectedWireframe, setSelectedWireframe] = useState<EnhancedWireframe | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'html' | 'debug'>('preview');
  const [hasGenerated, setHasGenerated] = useState(false);

  const wireframeService = WireframeService.getInstance();

  useEffect(() => {
    console.log('WireframeGenerated initialized with projectId:', projectId);
    
    if (projectId) {
      loadProjectData();
      checkAndGenerateWireframes();
    } else {
      setError('Project ID is required');
      setLoading(false);
    }
  }, [projectId]);

  const loadProjectData = () => {
    if (!projectId) {
      setError('Project ID is required');
      return;
    }

    const projectData = localStorageService.getProject(projectId);
    console.log('Project data from localStorage:', projectData);

    if (projectData) {
      setError(null);
      setProject(projectData);
    } else {
      setError('Project not found');
    }
  };

  const checkAndGenerateWireframes = async () => {
    if (!projectId) {
      setError('Project ID is required');
      setLoading(false);
      return;
    }

    setError(null);

    const projectData = localStorageService.getProject(projectId);
    if (!projectData) {
      setError('Project not found');
      setLoading(false);
      return;
    }

    setProject(projectData);

    const existingWireframes = localStorageService.getWireframesByProject(projectId);
    console.log(`Found ${existingWireframes.length} existing wireframes for project ${projectId}`);

    if (existingWireframes.length === 0 && !hasGenerated) {
      console.log('No existing wireframes found, auto-generating...');
      setHasGenerated(true);
      await handleGenerateWireframes();
    } else {
      console.log('Loading existing wireframes...');
      await loadEnhancedWireframes();
    }
  };

  const loadEnhancedWireframes = async () => {
    if (!projectId) return;

    try {
      setError(null);
      // Use the enhanced service method to get wireframes with display data
      const enhancedWireframes = await wireframeService.getWireframesForDisplay(projectId);
      console.log('Loaded enhanced wireframes:', enhancedWireframes);
      setWireframes(enhancedWireframes);
      setLoading(false);
    } catch (error) {
      console.error('Error loading enhanced wireframes:', error);
      setError('Failed to load wireframes.');
      setLoading(false);
    }
  };

  const handleGenerateWireframes = async () => {
    if (!projectId) {
      setError('Project ID is required');
      return;
    }

    setGenerating(true);
    setLoading(true);
    setError(null);
    setSuccess(null);

    const progressInterval = simulateProgress();

    try {
      const project = localStorageService.getProject(projectId);
      if (!project) {
        throw new Error('Project not found in localStorage');
      }

      console.log('🔄 Generating wireframes for project:', project.title);
      
      const result = await wireframeService.generateWireframes(projectId, project);
      
      if (result.success) {
        const successMsg = `Successfully generated ${result.count || 0} wireframes!`;
        console.log(successMsg);
        setSuccess(successMsg);
        
        setProgress(100);
        setTimeout(async () => {
          await loadEnhancedWireframes();
          setGenerating(false);
        }, 500);
      } else {
        throw new Error(result.error || 'Wireframe generation failed');
      }

    } catch (err) {
      console.error('Wireframe generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(`Failed to generate wireframes: ${errorMessage}`);
      
      setGenerating(false);
      setLoading(false);
      setHasGenerated(false);
    } finally {
      clearInterval(progressInterval);
    }
  };

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 2;
      });
    }, 100);
    return interval;
  };

  const handleAccept = () => {
    if (projectId) {
      navigate(`/hasil-generate/${projectId}`);
    } else {
      navigate('/hasil-generate');
    }
  };

  const handleEdit = () => {
    if (projectId) {
      navigate(`/edit-wireframe/${projectId}`);
    } else {
      navigate('/edit-wireframe');
    }
  };

  const handleViewDetails = async (wireframe: EnhancedWireframe) => {
    try {
      // Load full details including LLM response
      const details = await wireframeService.getWireframeDetails(wireframe.wireframe_id);
      setSelectedWireframe(details);
      setActiveTab('preview');
    } catch (error) {
      console.error('Error loading wireframe details:', error);
      setSelectedWireframe(wireframe);
      setActiveTab('preview');
    }
  };

  const handleCloseDetails = () => {
    setSelectedWireframe(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Code copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  // Render HTML preview in iframe
  const renderHTMLPreview = (htmlContent: string, large: boolean = false) => {
    const height = large ? '500px' : '200px';
    
    return (
      <div className="w-full bg-white border rounded-lg overflow-hidden" style={{ height }}>
        <iframe
          srcDoc={htmlContent}
          title="HTML Preview"
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
        />
      </div>
    );
  };

  // Render enhanced wireframe card
  const renderWireframeCard = (wireframe: EnhancedWireframe) => {
    const displayData = wireframe.display_data;
    
    return (
      <div
        key={wireframe.wireframe_id}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:scale-[1.02] cursor-pointer"
        onClick={() => handleViewDetails(wireframe)}
      >
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-800 capitalize">
            {wireframe.page_name.replace('-', ' ')}
          </h3>
          <p className="text-sm text-gray-600">
            {wireframe.stories_count} stories • {wireframe.features_count} features
          </p>
          
          {/* Generation Status */}
          {displayData && (
            <div className="flex flex-wrap gap-1 mt-2">
              <span className={`px-2 py-1 text-xs rounded-full ${
                displayData.used_rag ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {displayData.used_rag ? '🤖 RAG' : '📝 Template'}
              </span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                displayData.has_valid_structure ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {displayData.has_valid_structure ? '✅ HTML' : '❌ HTML'}
              </span>
              {displayData.used_fallback && (
                <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
                  ⚠️ Fallback
                </span>
              )}
            </div>
          )}
        </div>

        {/* HTML Preview */}
        {renderHTMLPreview(wireframe.html_content, false)}
        
        {/* HTML Preview Text */}
        <div className="p-3 bg-gray-50 border-t">
          <div className="text-xs text-gray-600 mb-1">
            <strong>HTML Preview:</strong>
          </div>
          <div className="text-xs text-gray-700 line-clamp-2">
            {displayData?.html_preview || 'No preview available'}
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
            <span>Size: {wireframe.html_content?.length || 0} chars</span>
            <span>{new Date(wireframe.generated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  };

  // Render detailed view in modal
  const renderDetailedView = (wireframe: EnhancedWireframe) => {
    const displayData = wireframe.display_data;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900 capitalize">
              {wireframe.page_name.replace('-', ' ')}
            </h2>
            <button
              onClick={handleCloseDetails}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <div className="flex space-x-1 px-6">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-[#4699DF] text-[#4699DF]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                HTML Preview
              </button>
              <button
                onClick={() => setActiveTab('html')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'html'
                    ? 'border-[#4699DF] text-[#4699DF]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Raw HTML
              </button>
              <button
                onClick={() => setActiveTab('debug')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'debug'
                    ? 'border-[#4699DF] text-[#4699DF]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                LLM Debug
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {activeTab === 'preview' && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">Live HTML Preview</h3>
                  {renderHTMLPreview(wireframe.html_content, true)}
                </div>
                
                {/* Generation Info */}
                {displayData && (
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                    <div>
                      <strong className="text-gray-700">Page Type:</strong> 
                      <span className="ml-2 capitalize text-gray-600">{wireframe.page_type}</span>
                    </div>
                    <div>
                      <strong className="text-gray-700">Stories:</strong> 
                      <span className="ml-2 text-gray-600">{wireframe.stories_count}</span>
                    </div>
                    <div>
                      <strong className="text-gray-700">Features:</strong> 
                      <span className="ml-2 text-gray-600">{wireframe.features_count}</span>
                    </div>
                    <div>
                      <strong className="text-gray-700">Generated:</strong> 
                      <span className="ml-2 text-gray-600">{new Date(wireframe.generated_at).toLocaleString()}</span>
                    </div>
                    <div>
                      <strong className="text-gray-700">HTML Size:</strong> 
                      <span className="ml-2 text-gray-600">{wireframe.html_content?.length || 0} chars</span>
                    </div>
                    <div>
                      <strong className="text-gray-700">Used RAG:</strong> 
                      <span className="ml-2 text-gray-600">{displayData.used_rag ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <strong className="text-gray-700">Structure:</strong> 
                      <span className={`ml-2 ${displayData.has_valid_structure ? 'text-green-600' : 'text-red-600'}`}>
                        {displayData.has_valid_structure ? 'Valid' : 'Invalid'}
                      </span>
                    </div>
                    <div>
                      <strong className="text-gray-700">Status:</strong> 
                      <span className="ml-2 text-gray-600 capitalize">{displayData.debug_status}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'html' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Raw HTML Code</h3>
                  <button
                    onClick={() => copyToClipboard(wireframe.html_content)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Copy HTML
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <pre className="text-green-400 p-4 overflow-x-auto text-sm max-h-96">
                    {wireframe.html_content || 'No HTML content available.'}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'debug' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">LLM Generation Details</h3>
                  
                  {displayData && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">Generation Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-blue-700">LLM Response Length:</span>
                            <span className="font-medium">{displayData.llm_response_length} chars</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">HTML Length:</span>
                            <span className="font-medium">{displayData.html_length} chars</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">UI Patterns Used:</span>
                            <span className="font-medium">{displayData.ui_patterns_used}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Project Patterns Used:</span>
                            <span className="font-medium">{displayData.project_patterns_used}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-2">Generation Status</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-green-700">Status:</span>
                            <span className={`font-medium capitalize ${
                              displayData.debug_status === 'success' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {displayData.debug_status}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-700">Used RAG:</span>
                            <span className="font-medium">{displayData.used_rag ? '✅ Yes' : '❌ No'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-700">Used Fallback:</span>
                            <span className="font-medium">{displayData.used_fallback ? '⚠️ Yes' : '✅ No'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-700">HTML Structure:</span>
                            <span className={`font-medium ${
                              displayData.has_valid_structure ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {displayData.has_valid_structure ? 'Valid' : 'Invalid'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {displayData?.generation_error && (
                    <div className="bg-red-50 p-4 rounded-lg mb-4">
                      <h4 className="font-semibold text-red-800 mb-2">Generation Error</h4>
                      <pre className="text-red-700 text-sm whitespace-pre-wrap">
                        {displayData.generation_error}
                      </pre>
                    </div>
                  )}

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-2">LLM Response Preview</h4>
                    <pre className="text-gray-700 text-sm whitespace-pre-wrap bg-white p-3 rounded border max-h-40 overflow-y-auto">
                      {displayData?.llm_response_preview || 'No LLM response data available'}
                    </pre>
                  </div>

                  {wireframe.full_llm_response && (
                    <details className="bg-gray-50 p-4 rounded-lg">
                      <summary className="font-semibold text-gray-800 cursor-pointer">
                        View Full LLM Response
                      </summary>
                      <pre className="text-gray-700 text-sm whitespace-pre-wrap bg-white p-3 rounded border mt-2 max-h-60 overflow-y-auto">
                        {wireframe.full_llm_response}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4699DF] mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {generating
                ? (isAuthenticated ? 'Generating wireframes with AI...' : 'Generating wireframes locally...')
                : 'Loading wireframes...'
              }
            </p>

            {generating && (
              <div className="mt-4 w-64 mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Generating...
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-[#5561AA] to-[#4699DF] h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-800">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {/* Title */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="mb-4 mt-4 text-4xl font-bold md:text-5xl">
              Wireframe Results
            </h1>
            {project && (
              <p className="text-xl text-gray-600">{project.title}</p>
            )}
            {projectId && (
              <p className="text-gray-600">
                {wireframes.length} wireframes generated
              </p>
            )}
          </div>

          {/* Authentication Status */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isAuthenticated
            ? 'bg-green-100 text-green-800'
            : 'bg-blue-100 text-blue-800'
            }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${isAuthenticated ? 'bg-green-500' : 'bg-blue-500'
              }`}></span>
            {isAuthenticated ? `Online Mode (${user?.username})` : 'Offline Mode (Local)'}
          </div>
        </div>

        {/* Progress Bar */}
        {generating && (
          <div className="mb-10 w-full bg-gray-200 rounded-full h-5 overflow-hidden relative shadow-inner">
            <div
              className="absolute left-0 top-0 h-5 bg-gradient-to-r from-[#5561AA] to-[#4699DF] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow-sm">
              Process Generate LLM ({progress}%)
            </span>
          </div>
        )}

        {/* Status Messages */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  {success}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Generated Wireframes Grid */}
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold underline">
            Generated Wireframes
          </h2>

          {wireframes.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No wireframes found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {isAuthenticated
                  ? "Get started by generating wireframes for your project."
                  : "Get started by generating wireframes locally."
                }
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleGenerateWireframes}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#4699DF] hover:bg-[#3a7bbf] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4699DF]"
                >
                  Generate Wireframes
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {wireframes.map(renderWireframeCard)}
              </div>
            </div>
          )}
        </section>

        {/* Wireframe Details Modal */}
        {selectedWireframe && renderDetailedView(selectedWireframe)}

        {/* Action Buttons */}
        {wireframes.length > 0 && (
          <div className="flex items-center justify-end gap-4 pb-6">
            <button
              onClick={handleEdit}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-[#4699DF] shadow-sm transition hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={handleAccept}
              className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 font-medium text-white shadow-sm transition hover:opacity-95"
            >
              Accept
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}