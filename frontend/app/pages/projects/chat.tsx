// frontend/src/pages/onboarding/chat.tsx
import React, { useState, useEffect } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { projectService } from "../../services/projectService";
import { localStorageService } from "../../utils/localStorageService";

interface ProjectFormData {
  goal: string;
  users: string;
  fitur: string;
  alur: string;
  scope: string;
  info: string;
}

export default function Chat() {
  const navigate = useNavigate();
  const { isAuthenticated, token, user, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState<ProjectFormData>({
    goal: "",
    users: "",
    fitur: "",
    alur: "",
    scope: "",
    info: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'guest' | 'user'>('guest');

  // Load existing project data ketika component mount
  useEffect(() => {
    console.log('🔄 Chat component mounted');
    console.log('Auth loading:', authLoading);
    console.log('Is authenticated:', isAuthenticated);
    console.log('User:', user);

    if (!authLoading) {
      if (isAuthenticated && user) {
        setMode('user');
        console.log('✅ User mode activated:', user.username);
      } else {
        setMode('guest');
        console.log('🟡 Guest mode activated');
        loadGuestProject();
      }
    }
  }, [isAuthenticated, user, authLoading]);

  const loadGuestProject = () => {
    try {
      console.log('📥 Loading guest project...');
      // Load existing guest project jika ada
      const projects = localStorageService.getAllProjects();
      console.log('Found projects:', projects.length);
      
      if (projects.length > 0) {
        const recentProject = projects[0]; // Ambil project terbaru
        console.log('Loading existing project:', recentProject);
        setFormData({
          goal: recentProject.objective || "",
          users: Array.isArray(recentProject.users_data) 
            ? recentProject.users_data.join(', ') 
            : recentProject.users_data || "",
          fitur: Array.isArray(recentProject.features_data) 
            ? recentProject.features_data.join(', ') 
            : recentProject.features_data || "",
          alur: recentProject.flow || "",
          scope: recentProject.scope || "",
          info: recentProject.additional_info || "",
        });
        console.log('✅ Loaded existing guest project:', recentProject.project_id);
      } else {
        console.log('ℹ️ No existing projects found');
      }
    } catch (error) {
      console.error('❌ Error loading guest project:', error);
    }
  };

  // Handle text change
  const handleChange = (field: keyof ProjectFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(""); // clear error when typing
  };

  // Debug function
  const debugLocalStorage = () => {
    console.log('=== 🐛 MANUAL DEBUG ===');
    localStorageService.debugStorage();
  };

  // Validate and submit
  const handleSubmit = async () => {
    console.log('🔄 SUBMISSION STARTED ==========');
    
    // Validasi form
    const validation = projectService.validateFormData(formData);
    if (!validation.isValid) {
      setError(`⚠️ ${validation.errors[0]}`);
      console.log('❌ Validation failed:', validation.errors);
      return;
    }

    console.log('✅ Form validation passed');
    setIsSubmitting(true);
    setError("");

    try {
      let projectId: string;

      if (mode === 'guest') {
        console.log('🟡 MODE: GUEST - Using localStorage');
        projectId = await projectService.createGuestProject(formData);
        console.log('✅ Guest project creation completed with ID:', projectId);
      } else {
        console.log('🔵 MODE: USER - Using API');
        if (!token) {
          throw new Error('Authentication token not found');
        }
        projectId = await projectService.createUserProject(formData, token);
        console.log('✅ User project creation completed with ID:', projectId);
      }

      // Show success message
      setError("✅ Project saved successfully! Redirecting...");
      console.log('🎉 Project saved successfully!');
      
      // Navigate setelah delay singkat
      setTimeout(() => {
        navigate("/UserStoryPage", { 
          state: { 
            projectId,
            mode,
            projectTitle: projectService.generateProjectTitle(formData.goal)
          } 
        });
      }, 1000);

    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to save project. Please try again.';
      
      setError(`❌ ${errorMessage}`);
      console.error("❌ SUBMISSION ERROR:", err);
    } finally {
      setIsSubmitting(false);
      console.log('🔄 SUBMISSION COMPLETED ==========');
    }
  };

  const calculateCompletion = (): number => {
    const fields = Object.values(formData);
    const filledFields = fields.filter(field => field.trim().length > 0).length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const completionPercentage = calculateCompletion();

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-white text-gray-900">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Checking authentication...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      <Header />

      <main className="flex-grow px-8 py-10 max-w-4xl mx-auto animate-fade-in-up relative pb-32">
        {/* Debug Button */}
        <button 
          onClick={debugLocalStorage}
          className="fixed top-20 right-6 bg-gray-500 text-white px-3 py-2 rounded text-sm z-50"
        >
          🐛 Debug
        </button>

        {/* Title and Mode Indicator */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold mb-4">
            INPUT YOUR PROJECT DESCRIPTION!
          </h1>
          
          {/* Mode Indicator */}
          <div className="mb-4">
            {mode === 'guest' ? (
              <div className="inline-flex items-center px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-full">
                <span className="text-yellow-800 text-sm font-medium">
                  🔓 Guest Mode - Data saved locally
                </span>
                <button 
                  onClick={() => navigate('/auth/signin')}
                  className="ml-2 text-yellow-700 hover:text-yellow-900 underline text-sm"
                >
                  Login to save permanently
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center px-4 py-2 bg-green-100 border border-green-300 rounded-full">
                <span className="text-green-800 text-sm font-medium">
                  🔐 Logged in as {user?.username} - Data saved to cloud
                </span>
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600">
            {completionPercentage}% Complete
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg text-center font-medium ${
            error.includes('✅') 
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {/* Main Goal */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Main Goal</h2>
          <textarea
            value={formData.goal}
            onChange={(e) => handleChange("goal", e.target.value)}
            placeholder="Ex: Help individuals manage their finances, track expenses, and make smarter investment decisions through AI-driven insights and automation."
            className="w-full p-3 rounded-md border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={3}
          />
          <div className="text-xs text-gray-500 mt-1">
            {formData.goal.length}/500 characters {formData.goal.length < 10 && "(minimum 10 characters)"}
          </div>
        </section>

        {/* Users */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Users</h2>
          <textarea
            value={formData.users}
            onChange={(e) => handleChange("users", e.target.value)}
            placeholder="Ex: Individual Users, Financial Advisors, Investment Managers, Administrators"
            className="w-full p-3 rounded-md border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={2}
          />
          <div className="text-xs text-gray-500 mt-1">
            Separate multiple users with commas
          </div>
        </section>

        {/* Fitur */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Fitur</h2>
          <textarea
            value={formData.fitur}
            onChange={(e) => handleChange("fitur", e.target.value)}
            placeholder="Ex: Automated expense tracking, AI-driven budgeting, personalized investment suggestions, etc."
            className="w-full p-3 rounded-md border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={3}
          />
          <div className="text-xs text-gray-500 mt-1">
            Separate multiple features with commas
          </div>
        </section>

        {/* Alur */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Alur</h2>
          <textarea
            value={formData.alur}
            onChange={(e) => handleChange("alur", e.target.value)}
            placeholder="Ex: User links bank accounts → System tracks transactions → AI generates budget plan → ..."
            className="w-full p-3 rounded-md border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={3}
          />
        </section>

        {/* Scope */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Scope</h2>
          <textarea
            value={formData.scope}
            onChange={(e) => handleChange("scope", e.target.value)}
            placeholder="Ex: Focuses on personal finance and investment guidance for individuals."
            className="w-full p-3 rounded-md border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={2}
          />
        </section>

        {/* Informasi Tambahan */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Informasi Tambahan</h2>
          <textarea
            value={formData.info}
            onChange={(e) => handleChange("info", e.target.value)}
            placeholder="Any other additional context or constraints about your project."
            className="w-full p-3 rounded-md border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={2}
          />
        </section>

        {/* Submit Button */}
        <div className="absolute bottom-10 right-12">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`
              bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold px-8 py-3 rounded-full shadow-lg
              transform transition-all duration-200 hover:scale-105 hover:shadow-xl
              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
              min-w-[160px]
            `}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
                {mode === 'guest' ? 'Saving...' : 'Creating...'}
              </div>
            ) : (
              mode === 'guest' ? 'Save Project' : 'Create Project'
            )}
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}