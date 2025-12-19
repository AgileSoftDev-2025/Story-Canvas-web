import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate, useParams } from "react-router-dom";
import { localStorageService } from "../../utils/localStorageService";
import type { LocalProject, LocalWireframe, LocalUserStory } from "../../utils/localStorageModels";
import { useAuth } from "../../context/AuthContext";
import { WireframeService } from "../../services/WireframeService";
import { wireframeAPIService } from "../../services/wireframeSyncService";

// ============ TYPES ============
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
  used_fallback?: boolean;
  used_rag?: boolean;
  png_url?: string;
  png_loading?: boolean;
  png_error?: string;
  png_generated?: boolean;
}

interface SyncInfo {
  is_synced: boolean;
  database: { wireframe_count: number; last_updated: string | null };
  local: { wireframe_count: number; last_updated: string | null };
  needs_sync: boolean;
  mode?: string;
}

// ============ CONSTANTS ============
const STATUS_COLORS = {
  loading: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  success: 'bg-green-100 text-green-800',
  fallback: 'bg-orange-100 text-orange-800'
} as const;

const TAB_OPTIONS = ['png', 'preview', 'html', 'salt'] as const;
type TabType = typeof TAB_OPTIONS[number];

// ============ UTILITY FUNCTIONS ============
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const generatePNGFromSalt = async (saltCode: string): Promise<{ 
  success: boolean; 
  png_url?: string; 
  error?: string 
}> => {
  if (!saltCode || saltCode.trim().length === 0) {
    return { success: false, error: 'No Salt UML code provided' };
  }

  try {
    const response = await fetch('/api/plantuml/generate-png/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salt_code: saltCode })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { success: false, error: 'Rate limited. Please try again later.' };
      }
      if (response.status === 413) {
        return { success: false, error: 'Salt code too large.' };
      }
      if (response.status === 400) {
        return { success: false, error: 'Invalid Salt UML syntax.' };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success && data.png_url 
      ? { success: true, png_url: data.png_url }
      : { success: false, error: data.error || 'Failed to generate PNG' };
  } catch (error) {
    console.error('Failed to generate PNG:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
};

// ============ SUB-COMPONENTS ============
interface LoadingStateProps {
  generating: boolean;
  progress: number;
  anyPNGsLoading: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({ generating, progress, anyPNGsLoading }) => (
  <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#4699DF] mx-auto mb-4"></div>
      <p className="text-xl font-medium text-gray-700 mb-2">
        {generating ? 'Generating Wireframes...' : 'Loading Wireframes...'}
      </p>
      <p className="text-gray-500 mb-6">
        {generating ? 'This may take a few moments while we generate your wireframes' : 'Loading wireframes and generating PNG diagrams...'}
      </p>
      
      {generating && (
        <div className="w-80 mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Generating...</span>
            <span className="text-sm font-medium text-gray-700">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#5561AA] to-[#4699DF] h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      <div className="mt-8 text-sm text-gray-400">
        <p>Loading wireframes and generating high-quality PNG diagrams...</p>
        {anyPNGsLoading && (
          <p className="mt-1 text-blue-500">
            • Generating PNG diagrams...
          </p>
        )}
      </div>
    </div>
  </div>
);

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry }) => (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-3">
        <p className="text-sm text-red-700">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="ml-4 text-sm text-blue-600 hover:text-blue-800 font-medium">
          Try Again
        </button>
      )}
    </div>
  </div>
);

interface SuccessDisplayProps {
  message: string;
}

const SuccessDisplay: React.FC<SuccessDisplayProps> = ({ message }) => (
  <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-3">
        <p className="text-sm text-green-700">{message}</p>
      </div>
    </div>
  </div>
);

interface SyncStatusPanelProps {
  syncInfo: SyncInfo;
  syncStatus: string | null;
  syncLoading: boolean;
  onManualSync: () => void;
}

const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({ syncInfo, syncStatus, syncLoading, onManualSync }) => (
  <div className="bg-gray-50 p-3 rounded-lg border">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium">Sync Status</span>
      <span className={`text-xs px-2 py-1 rounded-full ${
        syncInfo.is_synced ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      }`}>
        {syncInfo.is_synced ? 'Synced' : 'Out of Sync'}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <span className="text-gray-600">Local:</span>
        <span className="ml-1 font-medium">{syncInfo.local.wireframe_count}</span>
      </div>
      <div>
        <span className="text-gray-600">Database:</span>
        <span className="ml-1 font-medium">{syncInfo.database.wireframe_count}</span>
      </div>
    </div>
    {syncStatus && <p className="text-xs mt-2 text-gray-600">{syncStatus}</p>}
    {syncInfo.needs_sync && (
      <button
        onClick={onManualSync}
        disabled={syncLoading}
        className="w-full mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {syncLoading ? 'Syncing...' : 'Sync Now'}
      </button>
    )}
  </div>
);

interface WireframeCardProps {
  wireframe: EnhancedWireframe;
  onViewDetails: (wireframe: EnhancedWireframe) => void;
  onGeneratePNG: (id: string, saltCode: string) => void;
  onOpenFullscreen: (url: string) => void;
}

const WireframeCard: React.FC<WireframeCardProps> = ({ wireframe, onViewDetails, onGeneratePNG, onOpenFullscreen }) => {
  const storiesCount = wireframe.stories_count || 0;
  const featuresCount = wireframe.features_count || 0;
  const pageName = wireframe.page_name || 'Unnamed Page';
  const htmlContent = wireframe.html_content || '';
  const generatedAt = wireframe.generated_at || new Date().toISOString();
  const usedFallback = wireframe.used_fallback || false;
  const pngUrl = wireframe.png_url;
  const pngLoading = wireframe.png_loading;
  const pngError = wireframe.png_error;

  const renderPNGDiagram = (showActions: boolean = true) => {
    if (pngLoading) {
      return (
        <div className="h-48 w-full bg-gray-100 border rounded-lg flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-gray-600 text-sm">Generating PNG...</p>
        </div>
      );
    }
    
    if (pngError) {
      return (
        <div className="h-48 w-full bg-gray-100 border rounded-lg flex flex-col items-center justify-center">
          <svg className="h-12 w-12 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-gray-700 text-sm mb-2">Failed to generate PNG</p>
          {wireframe.salt_diagram && showActions && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGeneratePNG(wireframe.wireframe_id || '', wireframe.salt_diagram || '');
              }}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Try Again
            </button>
          )}
        </div>
      );
    }
    
    if (pngUrl) {
      return (
        <div className="h-48 w-full bg-white border rounded-lg overflow-hidden relative group">
          <img
            src={pngUrl}
            alt={`${pageName} - PNG Diagram`}
            className="w-full h-full object-contain bg-white cursor-zoom-in transition-transform duration-300 group-hover:scale-105"
            onClick={() => onOpenFullscreen(pngUrl)}
            loading="lazy"
            onError={(e) => {
              console.error('Error loading PNG diagram from:', pngUrl);
              const img = e.target as HTMLImageElement;
              img.src = `data:image/svg+xml;base64,${btoa(`
                <svg width="400" height="300" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="400" height="300" fill="#f5f5f5"/>
                  <text x="200" y="140" font-family="Arial" font-size="14" fill="#666" text-anchor="middle">PNG Diagram</text>
                  <text x="200" y="160" font-family="Arial" font-size="12" fill="#999" text-anchor="middle">Error loading image</text>
                </svg>
              `)}`;
            }}
          />
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            PNG Diagram
          </div>
        </div>
      );
    }
    
    return (
      <div className="h-48 w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center">
        <svg className="h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-600 text-sm mb-3">Generate PNG from Salt UML</p>
        {wireframe.salt_diagram ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGeneratePNG(wireframe.wireframe_id || '', wireframe.salt_diagram || '');
            }}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Generate PNG
          </button>
        ) : (
          <p className="text-gray-400 text-xs">No Salt UML available</p>
        )}
      </div>
    );
  };

  return (
    <div
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer"
      onClick={() => onViewDetails(wireframe)}
    >
      <div className="p-4 border-b">
        <h3 className="font-semibold text-gray-800 capitalize truncate">
          {pageName.replace(/-/g, ' ')}
        </h3>
        <p className="text-sm text-gray-600">
          {storiesCount} stories • {featuresCount} features
        </p>
        
        <div className="flex flex-wrap gap-1 mt-2">
          {usedFallback ? (
            <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
              ⚠️ Fallback
            </span>
          ) : (
            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
              🤖 AI
            </span>
          )}
          <span className={`px-2 py-1 text-xs rounded-full ${
            htmlContent && (htmlContent.includes('<!DOCTYPE') || htmlContent.includes('<html')) 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {htmlContent && (htmlContent.includes('<!DOCTYPE') || htmlContent.includes('<html')) 
              ? '✅ HTML' 
              : '❌ HTML'}
          </span>
          {pngLoading ? (
            <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
              ⏳ PNG Generating...
            </span>
          ) : pngUrl ? (
            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
              🖼️ PNG Ready
            </span>
          ) : pngError ? (
            <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
              ❌ PNG Failed
            </span>
          ) : (
            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
              📋 Salt UML Code
            </span>
          )}
        </div>
      </div>

      {/* PNG Diagram as main card content */}
      {renderPNGDiagram(false)}
      
      <div className="p-3 bg-gray-50 border-t">
        <div className="text-xs text-gray-600 mb-1 truncate">
          <strong>Preview:</strong> {pageName.replace(/-/g, ' ')} Wireframe
        </div>
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span className="truncate">Click to view details</span>
          <span className="whitespace-nowrap">{new Date(generatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

interface WireframeDetailsModalProps {
  wireframe: EnhancedWireframe;
  onClose: () => void;
  onGeneratePNG: (id: string, saltCode: string) => void;
  onOpenFullscreen: (url: string) => void;
  onCopyToClipboard: (text: string) => void;
  activeTab: TabType;
}

const WireframeDetailsModal: React.FC<WireframeDetailsModalProps> = ({ 
  wireframe, 
  onClose, 
  onGeneratePNG, 
  onOpenFullscreen,
  onCopyToClipboard,
  activeTab: initialTab 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const pageName = wireframe.page_name || 'Unnamed Page';
  const htmlContent = wireframe.html_content || '';
  const saltContent = wireframe.salt_diagram || '';

  const renderPNGDiagram = (large: boolean = true) => {
    if (wireframe.png_loading) {
      return (
        <div className={`w-full bg-gray-100 border rounded-lg flex flex-col items-center justify-center ${large ? 'h-96' : 'h-48'}`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-gray-600 text-sm">Generating PNG...</p>
        </div>
      );
    }
    
    if (wireframe.png_error) {
      return (
        <div className={`w-full bg-gray-100 border rounded-lg flex flex-col items-center justify-center ${large ? 'h-96' : 'h-48'}`}>
          <svg className="h-12 w-12 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-gray-700 text-sm mb-2">Failed to generate PNG</p>
          <p className="text-gray-500 text-xs mb-3">{wireframe.png_error}</p>
          <button
            onClick={() => onGeneratePNG(wireframe.wireframe_id || '', saltContent)}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Try Again
          </button>
        </div>
      );
    }
    
    if (wireframe.png_url) {
      return (
        <div className="w-full bg-white border rounded-lg overflow-hidden relative group" style={{ height: large ? '500px' : '200px' }}>
          <img
            src={wireframe.png_url}
            alt={`${pageName} - PNG Diagram`}
            className="w-full h-full object-contain bg-white cursor-zoom-in transition-transform duration-300 group-hover:scale-105"
            onClick={() => onOpenFullscreen(wireframe.png_url || '')}
          />
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            PNG Diagram
          </div>
        </div>
      );
    }
    
    return (
      <div className={`w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center ${large ? 'h-96' : 'h-48'}`}>
        <svg className="h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-600 text-sm mb-3">Generate PNG from Salt UML</p>
        {saltContent ? (
          <button
            onClick={() => onGeneratePNG(wireframe.wireframe_id || '', saltContent)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Generate PNG
          </button>
        ) : (
          <p className="text-gray-400 text-xs">No Salt UML available</p>
        )}
      </div>
    );
  };

  const renderHTMLPreview = (large: boolean = false) => {
    if (!htmlContent) {
      return (
        <div className={`w-full bg-gray-100 border rounded-lg flex items-center justify-center ${large ? 'h-96' : 'h-48'}`}>
          <p className="text-gray-500">No HTML content available</p>
        </div>
      );
    }

    const safeHtml = htmlContent || '<html><body><p>No content</p></body></html>';
    return (
      <div className="w-full bg-white border rounded-lg overflow-hidden" style={{ height: large ? '500px' : '200px' }}>
        <iframe
          srcDoc={safeHtml}
          title="HTML Preview"
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
          onError={(e) => {
            const iframe = e.target as HTMLIFrameElement;
            iframe.srcdoc = '<html><body><p style="color: red;">Error loading preview</p></body></html>';
          }}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900 capitalize">
            {pageName.replace(/-/g, ' ')} - Wireframe Details
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b">
          <div className="flex space-x-1 px-6 overflow-x-auto">
            {TAB_OPTIONS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-[#4699DF] text-[#4699DF]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'png' && 'PNG Diagram'}
                {tab === 'preview' && 'HTML Preview'}
                {tab === 'html' && 'Raw HTML'}
                {tab === 'salt' && 'Salt UML Code'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'png' && (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">PNG Diagram</h3>
                  <div className="flex gap-2">
                    {!wireframe.png_url && !wireframe.png_loading && (
                      <button
                        onClick={() => onGeneratePNG(wireframe.wireframe_id || '', saltContent)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                        disabled={!saltContent}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate PNG
                      </button>
                    )}
                    {wireframe.png_url && (
                      <div className="flex gap-2">
                        <a
                          href={wireframe.png_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 inline-flex items-center gap-1"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download PNG
                        </a>
                        <button
                          onClick={() => onOpenFullscreen(wireframe.png_url || '')}
                          className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 inline-flex items-center gap-1"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                          </svg>
                          Full Screen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  High-quality PNG generated from Salt UML code. Click on the image to view full screen.
                </p>
                
                {renderPNGDiagram(true)}
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Live HTML Preview</h3>
                {renderHTMLPreview(true)}
              </div>
            </div>
          )}

          {activeTab === 'html' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Raw HTML Code</h3>
                <button
                  onClick={() => onCopyToClipboard(htmlContent)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  disabled={!htmlContent}
                >
                  Copy HTML
                </button>
              </div>
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <pre className="text-green-400 p-4 overflow-x-auto text-sm max-h-96">
                  {htmlContent || 'No HTML content available.'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'salt' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Salt UML Code</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => onCopyToClipboard(saltContent)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    disabled={!saltContent}
                  >
                    Copy Salt
                  </button>
                  {saltContent && !wireframe.png_url && !wireframe.png_loading && (
                    <button
                      onClick={() => {
                        setActiveTab('png');
                        onGeneratePNG(wireframe.wireframe_id || '', saltContent);
                      }}
                      className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors inline-flex items-center gap-1"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Generate PNG
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <pre className="text-amber-400 p-4 overflow-x-auto text-sm max-h-96 font-mono">
                  {saltContent || 'No Salt UML content available.'}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {activeTab === 'png' && 'PNG Diagram'}
              {activeTab === 'preview' && 'HTML Preview'}
              {activeTab === 'html' && 'Raw HTML Code'}
              {activeTab === 'salt' && 'Salt UML Code'}
            </div>
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FullscreenImageModalProps {
  imageUrl: string;
  onClose: () => void;
}

const FullscreenImageModal: React.FC<FullscreenImageModalProps> = ({ imageUrl, onClose }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `wireframe-diagram-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className="relative w-full h-full">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <button onClick={handleDownload} className="absolute top-4 left-4 z-10 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        
        <img src={imageUrl} alt="Full screen diagram" className="w-full h-full object-contain" />
        
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded">
          Click anywhere or press ESC to close
        </div>
      </div>
    </div>
  );
};

// ============ MAIN COMPONENT ============
export default function WireframeGenerated() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user, isAuthenticated } = useAuth();

  // State management
  const [wireframes, setWireframes] = useState<EnhancedWireframe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
  const [project, setProject] = useState<LocalProject | null>(null);
  const [selectedWireframe, setSelectedWireframe] = useState<EnhancedWireframe | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Refs for state management
  const generationInProgressRef = useRef(false);
  const pngGenerationQueueRef = useRef<Set<string>>(new Set());
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const wireframeService = WireframeService.getInstance();

  const cleanupDuplicateWireframeStorage = useCallback(() => {
  try {
    console.log('🔧 Cleaning up duplicate wireframe storage on component mount...');
    
    // Get all localStorage keys
    const allKeys = Object.keys(localStorage);
    
    // Find all wireframe-related keys except local_wireframes
    const wireframeKeys = allKeys.filter(key => 
      key.toLowerCase().includes('wireframe') && 
      key !== 'local_wireframes'
    );
    
    // If we find duplicates, consolidate them
    if (wireframeKeys.length > 0) {
      console.log(`⚠️ Found ${wireframeKeys.length} duplicate wireframe keys:`, wireframeKeys);
      
      // Start with current wireframes from local_wireframes
      let allWireframes = localStorageService.getAllWireframes();
      
      // Collect from duplicates
      wireframeKeys.forEach(key => {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const wireframes = JSON.parse(data);
            if (Array.isArray(wireframes)) {
              console.log(`📦 Found ${wireframes.length} wireframes in duplicate key: ${key}`);
              allWireframes = [...allWireframes, ...wireframes];
            }
          }
        } catch (e) {
          console.log(`⚠️ Could not parse ${key}:`, e);
        }
        
        // Remove the duplicate key
        localStorage.removeItem(key);
        console.log(`🗑️ Removed duplicate key: ${key}`);
      });
      
      // Remove duplicates by wireframe_id
      const uniqueWireframes = Array.from(
        new Map(allWireframes.map(wf => [wf.wireframe_id, wf])).values()
      );
      
      // Save all unique wireframes back to local_wireframes
      localStorage.setItem('local_wireframes', JSON.stringify(uniqueWireframes));
      console.log(`✅ Consolidated ${uniqueWireframes.length} wireframes to local_wireframes`);
      
    } else {
      console.log('✅ No duplicate wireframe storage found');
    }
  } catch (error) {
    console.error('Error cleaning up duplicate storage:', error);
  }
}, []);


  // Cleanup function for duplicate wireframe storage
  const cleanupDuplicateStorage = useCallback(() => {
    try {
      console.log('🔧 Cleaning up duplicate wireframe storage...');
      
      const allKeys = Object.keys(localStorage);
      const wireframeKeys = allKeys.filter(key => 
        key.toLowerCase().includes('wireframe') && 
        key !== 'local_wireframes'
      );
      
      if (wireframeKeys.length > 0) {
        console.log(`⚠️ Found ${wireframeKeys.length} duplicate wireframe keys:`, wireframeKeys);
        
        // Start with current wireframes
        let allWireframes = localStorageService.getAllWireframes();
        
        wireframeKeys.forEach(key => {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const wireframes = JSON.parse(data);
              if (Array.isArray(wireframes)) {
                console.log(`📦 Found ${wireframes.length} wireframes in duplicate key: ${key}`);
                allWireframes = [...allWireframes, ...wireframes];
              }
            }
          } catch (e) {
            console.log(`⚠️ Could not parse ${key}:`, e);
          }
          
          // Remove the duplicate key
          localStorage.removeItem(key);
          console.log(`🗑️ Removed duplicate key: ${key}`);
        });
        
        // Remove duplicates by wireframe_id
        const uniqueWireframes = Array.from(
          new Map(allWireframes.map(wf => [wf.wireframe_id, wf])).values()
        );
        
        // Save all unique wireframes
        localStorage.setItem('local_wireframes', JSON.stringify(uniqueWireframes));
        console.log(`✅ Consolidated ${uniqueWireframes.length} wireframes to local_wireframes`);
        
        // Debug: Show storage status
        const finalWireframes = localStorageService.getAllWireframes();
        console.log(`📊 Final wireframe count in local_wireframes: ${finalWireframes.length}`);
      } else {
        console.log('✅ No duplicate wireframe storage found');
      }
    } catch (error) {
      console.error('Error cleaning up duplicate storage:', error);
    }
  }, []);

  // Enhanced cleanup function for component mount
  // Cleanup function for component unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Initial load with cleanup
  useEffect(() => {
    if (projectId) {
      // Run cleanup first
      cleanupDuplicateWireframeStorage();
      
      // Then load project data
      loadProjectData();
      handleInitialLoad();
    } else {
      setError('Project ID is required');
      setLoading(false);
    }
  }, [projectId, isAuthenticated, cleanupDuplicateWireframeStorage]);

  const loadProjectData = useCallback(() => {
    if (!projectId) {
      setError('Project ID is required');
      return;
    }

    try {
      const projectData = localStorageService.getProject(projectId);
      if (projectData) {
        setError(null);
        setProject(projectData);
      } else {
        setError('Project not found in local storage');
      }
    } catch (err) {
      console.error('Error loading project:', err);
      setError('Failed to load project data');
    }
  }, [projectId]);

  const handleInitialLoad = useCallback(async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem('access_token');
      
      if (isAuthenticated && authToken && projectId) {
        setSyncStatus('Syncing wireframes...');
        const syncStatusResult = await wireframeService.getWireframeSyncStatus(projectId, authToken);
        
        if (syncStatusResult.success && syncStatusResult.sync_status) {
          setSyncInfo(syncStatusResult.sync_status);
          
          if (syncStatusResult.sync_status.needs_sync) {
            const syncResult = await wireframeService.syncWireframes(projectId, authToken);
            if (syncResult.success) {
              setSyncStatus(syncResult.message);
              if (syncResult.syncedFromDb && syncResult.wireframeCount && syncResult.wireframeCount > 0) {
                setSuccess(`Loaded ${syncResult.wireframeCount} wireframes from database`);
              }
            } else {
              setSyncStatus(`⚠️ ${syncResult.message}`);
            }
          } else {
            setSyncStatus('✅ Wireframes are already synced');
          }
        } else {
          setSyncStatus('⚠️ Could not check sync status');
        }
      } else {
        setSyncStatus('Offline mode - using local data');
        setSyncInfo({
          is_synced: true,
          database: { wireframe_count: 0, last_updated: null },
          local: { wireframe_count: localStorageService.getWireframesByProject(projectId!).length, last_updated: null },
          needs_sync: false,
          mode: 'offline'
        });
      }
      
      await loadEnhancedWireframes();
    } catch (error) {
      console.error('Error during initial load:', error);
      setError('Failed to load wireframes');
    } finally {
      setLoading(false);
    }
  }, [projectId, isAuthenticated]);

  const loadEnhancedWireframes = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const localWireframes = localStorageService.getWireframesByProject(projectId);
      
      if (localWireframes.length === 0) {
        setWireframes([]);
        setLoading(false);
        return;
      }

      const enhancedWireframes: EnhancedWireframe[] = localWireframes.map(wf => {
        const isFallback = wf.html_content?.includes('fallback') || 
          wf.html_content?.includes('Fallback') ||
          wf.html_content?.includes('Using fallback') || 
          false;
        
        const hasRAG = wf.html_content?.includes('RAG') || 
          wf.html_content?.includes('rag') ||
          wf.generated_with_rag || 
          false;
        
        return {
          ...wf,
          used_fallback: isFallback,
          used_rag: hasRAG,
          png_loading: false,
          png_generated: false,
          display_data: {
            page_name: wf.page_name || 'Unnamed Page',
            page_type: wf.page_type || 'general',
            html_preview: wf.html_content ? 
              wf.html_content.substring(0, 200).replace(/<[^>]*>/g, '') + '...' : 
              'No HTML content',
            has_valid_structure: wf.html_content ? 
              wf.html_content.includes('<!DOCTYPE') || wf.html_content.includes('<html') : 
              false,
            stories_count: wf.stories_count || 0,
            features_count: wf.features_count || 0,
            generated_at: wf.generated_at || new Date().toISOString(),
            debug_status: isFallback ? 'fallback' : 'success',
            llm_response_preview: isFallback ? 'Used fallback template' : 'Generated by LLM',
            llm_response_length: 0,
            html_length: wf.html_content?.length || 0,
            used_rag: hasRAG,
            used_fallback: isFallback,
            ui_patterns_used: 0,
            project_patterns_used: 0
          }
        };
      });

      setWireframes(enhancedWireframes);
      
      // Update sync info with current local count
      if (syncInfo) {
        setSyncInfo(prev => prev ? {
          ...prev,
          local: {
            wireframe_count: enhancedWireframes.length,
            last_updated: enhancedWireframes.length > 0 
              ? new Date(Math.max(...enhancedWireframes.map(w => new Date(w.updated_at || w.created_at).getTime()))).toISOString()
              : null
          },
          is_synced: prev.database.wireframe_count === enhancedWireframes.length
        } : prev);
      }
      
      // Start automatic PNG generation
      enhancedWireframes.forEach((wireframe, index) => {
        if (wireframe.salt_diagram && !wireframe.png_url && !wireframe.png_loading) {
          setTimeout(() => {
            handleGeneratePNG(wireframe.wireframe_id || '', wireframe.salt_diagram || '');
          }, index * 500);
        }
      });
    } catch (error) {
      console.error('Error loading enhanced wireframes:', error);
      setError('Failed to load wireframes.');
    } finally {
      setLoading(false);
    }
  }, [projectId, syncInfo]);

  const handleManualSync = useCallback(async () => {
    if (!projectId) return;
    
    const authToken = localStorage.getItem('access_token');
    if (!authToken) {
      setError('Please login to sync with database');
      return;
    }
    
    setSyncLoading(true);
    setError(null);
    setSyncStatus('Syncing...');
    
    try {
      const syncResult = await wireframeService.twoWaySyncWireframes(projectId, authToken);
      
      if (syncResult.success) {
        setSuccess(`✅ ${syncResult.message}`);
        setSyncStatus(`✅ ${syncResult.message}`);
        
        const syncStatusResult = await wireframeService.getWireframeSyncStatus(projectId, authToken);
        if (syncStatusResult.success && syncStatusResult.sync_status) {
          setSyncInfo(syncStatusResult.sync_status);
        }
        
        await loadEnhancedWireframes();
      } else {
        setError(`⚠️ ${syncResult.message}`);
        setSyncStatus(`⚠️ ${syncResult.message}`);
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      setError('Sync failed');
      setSyncStatus('❌ Sync failed');
    } finally {
      setSyncLoading(false);
    }
  }, [projectId, loadEnhancedWireframes]);

  const handleForceSyncFromDatabase = useCallback(async () => {
    if (!projectId) return;
    
    const authToken = localStorage.getItem('access_token');
    if (!authToken) {
      setError('Please login to sync with database');
      return;
    }
    
    setSyncLoading(true);
    setError(null);
    setSyncStatus('Syncing from database...');
    
    try {
      const syncResult = await wireframeAPIService.syncDatabaseToLocalStorage(projectId, authToken);
      
      if (syncResult.success) {
        setSuccess(`✅ ${syncResult.message}`);
        setSyncStatus(`✅ ${syncResult.message}`);
        await loadEnhancedWireframes();
      } else {
        setError(`⚠️ ${syncResult.message}`);
        setSyncStatus(`⚠️ ${syncResult.message}`);
      }
    } catch (error) {
      console.error('Force sync failed:', error);
      setError('Force sync failed');
      setSyncStatus('❌ Sync failed');
    } finally {
      setSyncLoading(false);
    }
  }, [projectId, loadEnhancedWireframes]);

  const handleSyncToDatabase = useCallback(async () => {
    if (!projectId) return;
    
    const authToken = localStorage.getItem('access_token');
    if (!authToken) {
      setError('Please login to sync with database');
      return;
    }
    
    setSyncLoading(true);
    setError(null);
    setSyncStatus('Syncing to database...');
    
    try {
      const syncResult = await wireframeAPIService.syncLocalToDatabase(projectId, authToken);
      
      if (syncResult.success) {
        setSuccess(`✅ ${syncResult.message}`);
        setSyncStatus(`✅ ${syncResult.message}`);
        
        const syncStatusResult = await wireframeService.getWireframeSyncStatus(projectId, authToken);
        if (syncStatusResult.success && syncStatusResult.sync_status) {
          setSyncInfo(syncStatusResult.sync_status);
        }
      } else {
        setError(`⚠️ ${syncResult.message}`);
        setSyncStatus(`⚠️ ${syncResult.message}`);
      }
    } catch (error) {
      console.error('Sync to database failed:', error);
      setError('Sync to database failed');
      setSyncStatus('❌ Sync failed');
    } finally {
      setSyncLoading(false);
    }
  }, [projectId]);

  const handleGeneratePNG = useCallback(async (wireframeId: string, saltCode: string) => {
    if (pngGenerationQueueRef.current.has(wireframeId)) {
      return;
    }
    
    pngGenerationQueueRef.current.add(wireframeId);
    
    setWireframes(prev => prev.map(wf => {
      if (wf.wireframe_id === wireframeId) {
        return { ...wf, png_loading: true, png_error: undefined };
      }
      return wf;
    }));

    try {
      const result = await generatePNGFromSalt(saltCode);
      
      setWireframes(prev => prev.map(wf => {
        if (wf.wireframe_id === wireframeId) {
          if (result.success) {
            return { 
              ...wf, 
              png_url: result.png_url, 
              png_loading: false,
              png_error: undefined,
              png_generated: true
            };
          } else {
            return { 
              ...wf, 
              png_loading: false, 
              png_error: result.error,
              png_generated: false
            };
          }
        }
        return wf;
      }));

      if (selectedWireframe && selectedWireframe.wireframe_id === wireframeId) {
        setSelectedWireframe(prev => {
          if (!prev) return prev;
          if (result.success) {
            return { ...prev, png_url: result.png_url, png_loading: false, png_error: undefined, png_generated: true };
          } else {
            return { ...prev, png_loading: false, png_error: result.error, png_generated: false };
          }
        });
      }
    } catch (error) {
      console.error(`Error generating PNG for wireframe ${wireframeId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setWireframes(prev => prev.map(wf => {
        if (wf.wireframe_id === wireframeId) {
          return { 
            ...wf, 
            png_loading: false, 
            png_error: `Failed to generate PNG: ${errorMessage}`,
            png_generated: false
          };
        }
        return wf;
      }));
    } finally {
      pngGenerationQueueRef.current.delete(wireframeId);
    }
  }, [selectedWireframe]);

  const handleGenerateAllPNGs = useCallback(async () => {
    const wireframesWithSalt = wireframes.filter(wf => wf.salt_diagram && !wf.png_url && !wf.png_loading);
    
    for (const wf of wireframesWithSalt) {
      if (wf.wireframe_id && wf.salt_diagram) {
        await handleGeneratePNG(wf.wireframe_id, wf.salt_diagram);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }, [wireframes, handleGeneratePNG]);

  // Fixed Local wireframe generation function
  const handleGenerateLocalWireframes = useCallback(async () => {
    if (generationInProgressRef.current) {
      console.log('Generation already in progress, skipping...');
      return;
    }

    if (!projectId || !project) {
      setError('Project data is required');
      return;
    }

    const userStories: LocalUserStory[] = localStorageService.getUserStoriesByProject(projectId);
    if (!userStories || userStories.length === 0) {
      setError('No user stories found. Please create user stories first.');
      return;
    }

    generationInProgressRef.current = true;
    setGenerating(true);
    setLoading(true);
    setError(null);
    setSuccess(null);
    setSyncStatus(null);

    const simulateProgress = () => {
      setProgress(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 2;
        });
      }, 100);
      
      progressIntervalRef.current = interval;
      return interval;
    };

    simulateProgress();

    try {
      // Clear existing wireframes for this project
      const existingWireframes = localStorageService.getWireframesByProject(projectId);
      if (existingWireframes.length > 0) {
        localStorageService.clearProjectWireframes(projectId);
        setWireframes([]);
      }
      
      const projectData = {
        title: project.title || 'Local Project',
        objective: project.objective || '',
        users: project.users_data || [],
        features: project.features_data || [],
        scope: project.scope || '',
        flow: project.flow || '',
        additional_info: project.additional_info || '',
        domain: project.domain || 'general'
      };

      setSyncStatus('Generating wireframes for local project...');
      
      const response = await fetch('/api/local-projects/generate-wireframes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          project_data: projectData,
          user_stories: userStories
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Local wireframe generation failed');
      }

      const successMsg = `Successfully generated ${result.count || 0} wireframes for local project!`;
      setSuccess(successMsg);
      setSyncStatus(`✅ ${result.message}`);
      
      setProgress(100);
      
      // Save wireframes using the fixed localStorageService
      if (result.wireframes && result.wireframes.length > 0) {
        console.log(`💾 Saving ${result.wireframes.length} wireframes to local_wireframes...`);
        
        // Clear any existing wireframes for this project
        localStorageService.clearProjectWireframes(projectId);
        
        // Save each wireframe using the unified storage method
        result.wireframes.forEach((wireframe: LocalWireframe) => {
          try {
            // Prepare wireframe data for storage
            const wireframeData: Omit<LocalWireframe, 'wireframe_id' | 'created_at' | 'updated_at'> = {
              project_id: projectId,
              page_name: wireframe.page_name || 'unnamed-page',
              page_type: wireframe.page_type || 'general',
              description: wireframe.description || `Wireframe for ${wireframe.page_name}`,
              html_content: wireframe.html_content || '',
              creole_content: wireframe.creole_content || '',
              salt_diagram: wireframe.salt_diagram || '',
              generated_with_rag: wireframe.generated_with_rag || false,
              wireframe_type: wireframe.wireframe_type || 'desktop',
              version: wireframe.version || 1,
              preview_url: wireframe.preview_url || '',
              stories_count: wireframe.stories_count || 0,
              features_count: wireframe.features_count || 0,
              generated_at: wireframe.generated_at || new Date().toISOString(),
              is_local: true
            };

            // Use the wireframe's ID or generate a new one
            const wireframeId = wireframe.wireframe_id || `local_${projectId}_${wireframe.page_name}_${Date.now()}`;
            
            // Save to unified storage
            localStorageService.createWireframe(wireframeData, wireframeId);
            console.log(`✅ Saved wireframe ${wireframeId} to local_wireframes`);
            
          } catch (err) {
            console.error('Error saving wireframe:', err);
          }
        });
        
        console.log(`✅ All ${result.wireframes.length} wireframes saved to local_wireframes`);
        
        // Verify storage
        const savedCount = localStorageService.getWireframesByProject(projectId).length;
        console.log(`📊 Verified: ${savedCount} wireframes in local_wireframes for project ${projectId}`);
      }
      
      // Load the enhanced wireframes
      setTimeout(async () => {
        await loadEnhancedWireframes();
        setGenerating(false);
        generationInProgressRef.current = false;
        setLoading(false);
      }, 1000);
      
    } catch (err) {
      console.error('Local wireframe generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(`Failed to generate wireframes: ${errorMessage}`);
      setGenerating(false);
      setLoading(false);
      generationInProgressRef.current = false;
      setSyncStatus('❌ Generation failed');
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, [projectId, project, loadEnhancedWireframes]);

  const handleGenerateWireframes = useCallback(async () => {
    if (generationInProgressRef.current) {
      console.log('Generation already in progress, skipping...');
      return;
    }

    if (!projectId || !project) {
      setError('Project data is required');
      return;
    }

    generationInProgressRef.current = true;
    setGenerating(true);
    setLoading(true);
    setError(null);
    setSuccess(null);
    setSyncStatus(null);

    const simulateProgress = () => {
      setProgress(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 2;
        });
      }, 100);
      
      progressIntervalRef.current = interval;
      return interval;
    };

    simulateProgress();

    try {
      const existingWireframes = localStorageService.getWireframesByProject(projectId);
      if (existingWireframes.length > 0) {
        setWireframes([]);
      }
      
      const authToken = localStorage.getItem('access_token');
      
      if (!isAuthenticated || !authToken) {
        return await handleGenerateLocalWireframes();
      }
      
      const result = await wireframeService.generateWireframesWithSync(projectId, authToken, project);
      
      if (result.success) {
        const successMsg = `Successfully ${result.source === 'database' ? 'loaded' : 'generated'} ${result.count || 0} wireframes!`;
        setSuccess(successMsg);
        
        if ((result.source === 'database_generated' || result.source === 'offline_generated') && authToken) {
          setSyncStatus('Syncing new wireframes to database...');
          setTimeout(async () => {
            const syncResult = await wireframeAPIService.syncLocalToDatabase(projectId, authToken);
            if (syncResult.success) {
              setSyncStatus(`✅ Synced ${syncResult.syncedCount} wireframes to database`);
              
              const syncStatusResult = await wireframeService.getWireframeSyncStatus(projectId, authToken);
              if (syncStatusResult.success && syncStatusResult.sync_status) {
                setSyncInfo(syncStatusResult.sync_status);
              }
            } else {
              setSyncStatus(`⚠️ ${syncResult.message}`);
            }
          }, 1000);
        }
        
        setProgress(100);
        
        setTimeout(async () => {
          await loadEnhancedWireframes();
          setGenerating(false);
          generationInProgressRef.current = false;
        }, 1000);
      } else {
        throw new Error(result.error || 'Wireframe generation failed');
      }
    } catch (err) {
      console.error('Wireframe generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(`Failed to generate wireframes: ${errorMessage}`);
      setGenerating(false);
      setLoading(false);
      generationInProgressRef.current = false;
      setSyncStatus('❌ Generation failed');
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, [projectId, project, loadEnhancedWireframes, isAuthenticated, handleGenerateLocalWireframes]);

  const handleAccept = useCallback(() => {
    if (projectId) {
      navigate(`/hasil-generate/${projectId}`);
    } else {
      navigate('/hasil-generate');
    }
  }, [navigate, projectId]);

  const handleEdit = useCallback(() => {
    if (projectId) {
      navigate(`/edit-wireframe/${projectId}`);
    } else {
      navigate('/edit-wireframe');
    }
  }, [navigate, projectId]);

  const handleViewDetails = useCallback((wireframe: EnhancedWireframe) => {
    setSelectedWireframe(wireframe);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedWireframe(null);
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (projectId && project && !generating) {
      setError(null);
      setSuccess(null);
      setSyncStatus(null);
      await handleGenerateWireframes();
    }
  }, [projectId, project, generating, handleGenerateWireframes]);

  const copyToClipboard = useCallback((text: string) => {
    if (!text) {
      alert('No content to copy');
      return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
      alert('Code copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy to clipboard');
    });
  }, []);

  const openFullscreenImage = useCallback((imageUrl: string) => {
    setFullscreenImage(imageUrl);
  }, []);

  const closeFullscreenImage = useCallback(() => {
    setFullscreenImage(null);
  }, []);

  // Memoized values
  const isLoading = loading || generating;
  const hasWireframes = wireframes.length > 0;
  const anyPNGsLoading = useMemo(() => wireframes.some(w => w.png_loading), [wireframes]);
  const readyPNGsCount = useMemo(() => wireframes.filter(w => w.png_url).length, [wireframes]);

  if (isLoading) {
    return <LoadingState generating={generating} progress={progress} anyPNGsLoading={anyPNGsLoading} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-800">
      <Header />

      <main className="container mx-auto w-full max-w-7xl flex-1 px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
          <div>
            <h1 className="mb-2 mt-2 text-3xl md:text-4xl font-bold">
              Wireframe Results
            </h1>
            {project && (
              <p className="text-lg md:text-xl text-gray-600">{project.title}</p>
            )}
            {projectId && hasWireframes && (
              <div className="text-gray-600 space-y-1">
                <p>
                  {wireframes.length} wireframe{wireframes.length !== 1 ? 's' : ''} generated
                </p>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${
                    anyPNGsLoading ? 'bg-yellow-500 animate-pulse' :
                    readyPNGsCount > 0 ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <span className={`text-sm ${
                    anyPNGsLoading ? 'text-yellow-600' :
                    readyPNGsCount > 0 ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {anyPNGsLoading ? 'Generating PNGs...' :
                     readyPNGsCount > 0 ? 
                     `${readyPNGsCount} PNG diagram${readyPNGsCount !== 1 ? 's' : ''} ready` :
                     'PNGs will be generated automatically'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isAuthenticated ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${
                isAuthenticated ? 'bg-green-500' : 'bg-blue-500'
              }`}></span>
              {isAuthenticated ? `Online Mode (${user?.username})` : 'Offline Mode (Local)'}
            </div>
            
            {isAuthenticated && syncInfo && (
              <SyncStatusPanel
                syncInfo={syncInfo}
                syncStatus={syncStatus}
                syncLoading={syncLoading}
                onManualSync={handleManualSync}
              />
            )}
            
            {hasWireframes && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={generating}
                  className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    generating
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                      : 'bg-orange-500                      hover:bg-orange-600 text-white'
                  }`}
                >
                  {generating ? 'Regenerating...' : '🔄 Regenerate All'}
                </button>
                {wireframes.some(w => w.salt_diagram && !w.png_url && !w.png_loading) && (
                  <button
                    onClick={handleGenerateAllPNGs}
                    disabled={anyPNGsLoading}
                    className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      anyPNGsLoading
                        ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    🖼️ Generate All PNGs
                  </button>
                )}
                {!isAuthenticated && (
                  <button
                    onClick={handleGenerateLocalWireframes}
                    disabled={generating}
                    className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      generating
                        ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                        : 'bg-purple-500 hover:bg-purple-600 text-white'
                    }`}
                  >
                    🏠 Generate Local
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sync Actions for Authenticated Users */}
        {isAuthenticated && syncInfo && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-blue-800">Database Sync</h3>
                <p className="text-sm text-blue-600">
                  {syncInfo.local.wireframe_count} local wireframes • {syncInfo.database.wireframe_count} in database
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleForceSyncFromDatabase}
                  disabled={syncLoading}
                  className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                >
                  ⬇️ Sync from Database
                </button>
                <button
                  onClick={handleSyncToDatabase}
                  disabled={syncLoading}
                  className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  ⬆️ Sync to Database
                </button>
                <button
                  onClick={handleManualSync}
                  disabled={syncLoading}
                  className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors disabled:opacity-50"
                >
                  🔄 Two-way Sync
                </button>
              </div>
            </div>
            {syncLoading && (
              <div className="mt-2 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-blue-600">Syncing...</span>
              </div>
            )}
          </div>
        )}

        {generating && (
          <div className="mb-8 w-full bg-gray-200 rounded-full h-5 overflow-hidden relative shadow-inner">
            <div
              className="absolute left-0 top-0 h-5 bg-gradient-to-r from-[#5561AA] to-[#4699DF] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow-sm">
              Generating wireframes ({progress}%)
            </span>
          </div>
        )}

        {success && <SuccessDisplay message={success} />}

        {error && (
          <ErrorDisplay 
            message={error} 
            onRetry={!generating ? handleRegenerate : undefined}
          />
        )}

        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Generated Wireframes
            </h2>
            {hasWireframes && !generating && (
              <div className="flex gap-2">
                {isAuthenticated && syncInfo && (
                  <button
                    onClick={handleSyncToDatabase}
                    disabled={syncLoading}
                    className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                  >
                    {syncLoading ? 'Syncing...' : '⬆️ Sync to DB'}
                  </button>
                )}
                <button
                  onClick={handleGenerateWireframes}
                  className="px-4 py-2 text-sm font-medium bg-[#4699DF] hover:bg-[#3a7bbf] text-white rounded-md transition-colors"
                >
                  + Add More
                </button>
              </div>
            )}
          </div>

          {!hasWireframes ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-2xl">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No wireframes yet</h3>
              <p className="mt-1 text-gray-500">
                Generate wireframes to visualize your user stories as HTML pages with high-quality PNG diagrams.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleGenerateWireframes}
                  disabled={generating}
                  className={`inline-flex items-center px-6 py-3 text-base font-medium rounded-md transition-colors ${
                    generating
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#4699DF] hover:bg-[#3a7bbf] text-white'
                  }`}
                >
                  {generating ? 'Generating...' : 
                   isAuthenticated ? 'Generate Wireframes (Online)' : 'Generate Wireframes'}
                </button>
                
                {!isAuthenticated && (
                  <button
                    onClick={handleGenerateLocalWireframes}
                    disabled={generating}
                    className={`inline-flex items-center px-6 py-3 text-base font-medium rounded-md transition-colors ${
                      generating
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-purple-500 hover:bg-purple-600 text-white'
                    }`}
                  >
                    {generating ? 'Generating...' : 'Generate Local Wireframes'}
                  </button>
                )}
              </div>
              
              {/* Show info about local vs online */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-gray-600">
                  {isAuthenticated 
                    ? "✅ Online mode: Wireframes will be saved to database for backup and sync across devices."
                    : "🏠 Offline mode: Wireframes are saved locally to local_wireframes. Sign in to enable cloud backup and sync."
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-300 bg-white p-4 md:p-6 shadow-sm">
              <div className="mb-4 text-sm text-gray-600">
                <p className="font-medium mb-2">📊 Wireframes with Auto-Generated PNG Diagrams</p>
                <ul className="space-y-1">
                  <li className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                    <span>PNG diagrams are generated automatically for better quality</span>
                  </li>
                  <li className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-yellow-500 mr-2"></div>
                    <span>Click on any PNG to view full screen</span>
                  </li>
                  <li className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-blue-500 mr-2"></div>
                    <span>Click card to view details and other formats</span>
                  </li>
                  {isAuthenticated && (
                    <li className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-purple-500 mr-2"></div>
                      <span>Wireframes are automatically synced with database when online</span>
                    </li>
                  )}
                </ul>
                {anyPNGsLoading && (
                  <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                    <div className="flex items-center text-blue-700">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm">
                        Generating {wireframes.filter(w => w.png_loading).length} PNG diagram{wireframes.filter(w => w.png_loading).length !== 1 ? 's' : ''}...
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {wireframes.map((wireframe) => (
                  <WireframeCard
                    key={wireframe.wireframe_id || wireframe.page_name || Math.random().toString()}
                    wireframe={wireframe}
                    onViewDetails={handleViewDetails}
                    onGeneratePNG={handleGeneratePNG}
                    onOpenFullscreen={openFullscreenImage}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {selectedWireframe && (
          <WireframeDetailsModal
            wireframe={selectedWireframe}
            onClose={handleCloseDetails}
            onGeneratePNG={handleGeneratePNG}
            onOpenFullscreen={openFullscreenImage}
            onCopyToClipboard={copyToClipboard}
            activeTab={selectedWireframe.png_url ? 'png' : 'salt'}
          />
        )}
        
        {fullscreenImage && (
          <FullscreenImageModal
            imageUrl={fullscreenImage}
            onClose={closeFullscreenImage}
          />
        )}

        {hasWireframes && !generating && (
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pb-6">
            <button
              onClick={handleEdit}
              className="w-full sm:w-auto rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-[#4699DF] shadow-sm transition hover:bg-gray-50"
            >
              Edit Wireframes
            </button>
            <button
              onClick={handleAccept}
              className="w-full sm:w-auto rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-3 font-medium text-white shadow-sm transition hover:opacity-95"
            >
              Accept & Continue
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}