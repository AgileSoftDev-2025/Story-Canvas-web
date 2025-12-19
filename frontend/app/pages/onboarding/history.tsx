import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import {
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Check,
  Plus,
  FolderOpen,
  Calendar,
} from "lucide-react";

interface Project {
  project_id: string;
  title: string;
  objective: string;
  domain: string;
  status: string;
  language: string;
  created_date: string;
  last_modified: string;
  user_stories_count: number;
  wireframes_count: number;
  scenarios_count: number;
}

function HistoryContent() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  // ✅ Fetch projects based on logged-in user
  const fetchUserProjects = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');

      const response = await fetch('http://127.0.0.1:5173/api/history/projects/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for CORS with credentials
      });

      if (!response.ok) {
        if (response.status === 0) {
          // Network error or CORS blocked
          throw new Error('Network error: Unable to connect to server. Check CORS configuration.');
        }
        if (response.status === 401) {
          await logout();
          return;
        }
        if (response.status === 500) {
          throw new Error('Server error: Please check backend CORS configuration.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setProjects(data.data);
        setFilteredProjects(data.data);
      } else {
        throw new Error(data.error || 'Failed to load projects');
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load projects';
      setError(errorMessage);

      if (errorMessage.includes('CORS') || errorMessage.includes('Network')) {
        console.error('CORS/Network Issue Detected:');
        console.error('- Backend URL:', 'http://127.0.0.1:8000');
        console.error('- Frontend URL:', window.location.origin);
        console.error('- Check django-cors-headers is installed and configured');
      }

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProjects();
  }, [user]);

  // ✅ Filter projects based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProjects(projects);
      return;
    }

    const filtered = projects.filter(project =>
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.objective.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.domain.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredProjects(filtered);
  }, [searchTerm, projects]);

  // ✅ Close dropdown or rename modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
        setRenameId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Save rename result
  const handleRenameSave = async (projectId: string) => {
    if (!renameValue.trim()) return;

    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://127.0.0.1:8000/api/projects/${projectId}/update/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: renameValue.trim() }),
      });

      if (response.status === 401) {
        await logout();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update local state
          setProjects(prev =>
            prev.map(project =>
              project.project_id === projectId
                ? { ...project, title: renameValue.trim() }
                : project
            )
          );
          alert('Project renamed successfully!');
        }
      } else {
        throw new Error('Failed to rename project');
      }
    } catch (error) {
      console.error('Error renaming project:', error);
      alert('Failed to rename project');
    } finally {
      setRenameId(null);
      setOpenMenuId(null);
    }
  };

  // ✅ Delete project
  const handleDelete = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://127.0.0.1:8000/api/projects/${projectId}/delete/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        await logout();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Remove from local state
          setProjects(prev => prev.filter(project => project.project_id !== projectId));
          alert('Project deleted successfully!');
        }
      } else {
        throw new Error('Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    } finally {
      setOpenMenuId(null);
    }
  };

  // ✅ Click project → save to localStorage and navigate to detail
  const handleOpenProject = (projectId: string) => {
    // Save project ID to localStorage
    localStorage.setItem('current_project_id', projectId);

    // Navigate to project detail page
    navigate(`/project/${projectId}`);
  };

  // ✅ Click create new project button
  const handleCreateNew = () => {
    navigate('/chat');
  };

  // ✅ Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // ✅ Get status badge color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen font-sans bg-white text-gray-800">
        <Header />
        <main className="flex-grow px-8 md:px-24 lg:px-36 py-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4699DF] mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading your projects...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen font-sans bg-white text-gray-800">
        <Header />
        <main className="flex-grow px-8 md:px-24 lg:px-36 py-16 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-red-500 text-lg mb-4">Error loading projects</div>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={fetchUserProjects}
                className="bg-[#4699DF] text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
              >
                Try Again
              </button>
              <button
                onClick={handleCreateNew}
                className="border border-[#4699DF] text-[#4699DF] px-6 py-2 rounded-lg hover:bg-blue-50 transition"
              >
                Create New Project
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans bg-white text-gray-800">
      <Header />

      <main className="flex-grow px-4 md:px-8 lg:px-24 py-12 animate-fade-in-up">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-6 text-black">
          YOUR PROJECTS
        </h1>

        {/* Welcome message with user info */}
        {user && (
          <div className="text-center mb-8">
            <p className="text-gray-600">
              Welcome back, <span className="font-semibold text-[#4699DF]">{user.username}</span>!
            </p>
            <p className="text-gray-500 text-sm mt-1">
              You have {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* 🔹 Search Bar */}
        <div className="relative max-w-2xl mx-auto mb-8">
          <div className="p-[2px] rounded-full bg-gradient-to-r from-[#5F3D89] via-[#5561AA] to-[#4699DF]">
            <div className="flex items-center bg-white rounded-full overflow-hidden">
              <input
                type="text"
                placeholder="Search your projects by title, objective, or domain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow py-3 pl-6 pr-16 rounded-full bg-white text-gray-800 text-base placeholder-gray-400 focus:outline-none"
              />
              <button className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-[#5F3D89] to-[#4699DF] hover:opacity-90 p-2 rounded-full transition">
                <Search className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* 🔹 Create New Project Button */}
        <div className="text-center mb-8">
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#5F3D89] to-[#4699DF] text-white font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Create New Project
          </button>
        </div>

        {/* 🔹 Projects List */}
        <div className="space-y-4 max-w-6xl mx-auto">
          {filteredProjects.map((project) => (
            <div
              key={project.project_id}
              className="relative bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 group cursor-pointer"
              onClick={() => handleOpenProject(project.project_id)}
            >
              <div className="flex items-start justify-between">
                {/* Project Content */}
                <div className="flex items-start space-x-4 flex-grow">
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg group-hover:from-blue-100 group-hover:to-purple-100 transition">
                    <FolderOpen className="w-6 h-6 text-[#4699DF]" />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-xl text-gray-900 group-hover:text-[#4699DF] transition">
                        {project.title}
                      </h3>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>

                    <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                      {project.objective}
                    </p>

                    {/* Project metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Created: {formatDate(project.created_date)}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                          📊 {project.user_stories_count} Stories
                        </span>
                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                          🎨 {project.wireframes_count} Wireframes
                        </span>
                        <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium">
                          📝 {project.scenarios_count} Scenarios
                        </span>
                      </div>

                      {project.domain && (
                        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                          {project.domain}
                        </span>
                      )}

                      {project.language && (
                        <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-medium">
                          {project.language}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu Dropdown */}
                <div
                  className="relative flex-shrink-0"
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm whitespace-nowrap">
                      Modified: {formatDate(project.last_modified)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === project.project_id ? null : project.project_id);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Dropdown Menu */}
                  {openMenuId === project.project_id && (
                    <div className="absolute right-0 top-10 w-48 bg-white shadow-xl rounded-lg border border-gray-200 py-2 z-10 animate-fade-in-up">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameId(project.project_id);
                          setRenameValue(project.title);
                        }}
                        className="w-full flex items-center px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
                      >
                        <Pencil className="w-4 h-4 mr-2 text-gray-500" />
                        Rename Project
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project.project_id);
                        }}
                        className="w-full flex items-center px-4 py-2 text-red-600 hover:bg-gray-50 transition"
                      >
                        <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                        Delete Project
                      </button>
                    </div>
                  )}

                  {/* Inline Rename Input */}
                  {renameId === project.project_id && (
                    <div className="absolute right-0 top-12 w-72 bg-white border border-gray-300 rounded-xl shadow-2xl p-4 flex items-center space-x-2 z-20 animate-fade-in-up">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameSave(project.project_id);
                          }
                        }}
                        className="flex-grow border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4699DF] focus:border-transparent"
                        autoFocus
                        placeholder="Enter new project name"
                      />
                      <button
                        onClick={() => handleRenameSave(project.project_id)}
                        className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRenameId(null)}
                        className="p-2 bg-gray-300 hover:bg-gray-400 text-white rounded-lg transition"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredProjects.length === 0 && (
            <div className="text-center py-16">
              <FolderOpen className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <p className="text-gray-500 text-xl mb-3 font-medium">
                {searchTerm ? 'No projects match your search' : 'No projects yet'}
              </p>
              <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">
                {searchTerm
                  ? 'Try adjusting your search terms or create a new project'
                  : 'Start by creating your first project to organize your user stories, wireframes, and scenarios'
                }
              </p>
              {!searchTerm && (
                <button
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#5F3D89] to-[#4699DF] text-white font-semibold px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Project
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );

}

export default function History() {
  return (
    <ProtectedRoute>
      <HistoryContent />
    </ProtectedRoute>
  );
}