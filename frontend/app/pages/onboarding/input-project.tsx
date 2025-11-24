import React, { useState, useEffect } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { localStorageService } from "../../utils/localStorageService";

interface ProjectFormData {
  goal: string;
  users: string;
  fitur: string;
  alur: string;
  scope: string;
  info: string;
}

export default function InputProject() {
  const navigate = useNavigate();
  const { isAuthenticated, token, user } = useAuth();

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

  // Load existing project on component mount
  useEffect(() => {
    if (isAuthenticated) {
      setMode('user');
      // For logged-in users, we could load the most recent project here
      // or let them create a new one
    } else {
      setMode('guest');
      // Create guest user if none exists
      let currentUser = localStorageService.getCurrentUser();
      if (!currentUser) {
        currentUser = localStorageService.setCurrentUser({
          username: `guest_${Date.now()}`,
          email: `guest_${Date.now()}@example.com`,
          is_active: true,
          last_login: new Date().toISOString(),
        });
      }

      // Load guest project if exists
      const projects = localStorageService.getAllProjects();
      if (projects.length > 0 && currentUser) {
        // Load the most recent project
        const recentProject = projects[0];
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
      }
    }
  }, [isAuthenticated]);

  const handleChange = (field: keyof ProjectFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const validateForm = (): boolean => {
    const { goal, users, fitur, alur, scope, info } = formData;
    
    if (!goal.trim() || !users.trim() || !fitur.trim() || !alur.trim() || !scope.trim() || !info.trim()) {
      setError("⚠️ Please fill in all fields before proceeding.");
      return false;
    }

    if (goal.trim().length < 10) {
      setError("⚠️ Please provide a more detailed main goal (at least 10 characters).");
      return false;
    }

    if (users.trim().length < 5) {
      setError("⚠️ Please specify at least one user type.");
      return false;
    }

    return true;
  };

  // Handle guest mode submission
  const handleGuestSubmit = async (): Promise<string> => {
    const currentUser = localStorageService.getCurrentUser();
    if (!currentUser) {
      throw new Error('No guest user found');
    }

    const project = localStorageService.createProject({
      user_id: currentUser.id,
      title: `Project ${new Date().toLocaleDateString()}`,
      objective: formData.goal,
      scope: formData.scope,
      flow: formData.alur,
      additional_info: formData.info,
      domain: "general",
      language: "en",
      nlp_analysis: {},
      users_data: formData.users.split(',').map(u => u.trim()),
      features_data: formData.fitur.split(',').map(f => f.trim()),
      status: 'draft',
    });

    return project.project_id;
  };

  // Handle user mode submission
  const handleUserSubmit = async (): Promise<string> => {
    if (!token) throw new Error('No authentication token');
    
    const projectData = {
      title: `Project ${new Date().toLocaleDateString()}`,
      objective: formData.goal,
      scope: formData.scope,
      flow: formData.alur,
      additional_info: formData.info,
      domain: "general",
      language: "en",
      users_data: formData.users.split(',').map(u => u.trim()),
      features_data: formData.fitur.split(',').map(f => f.trim()),
      nlp_analysis: {},
      status: 'draft'
    };

    const response = await fetch('/api/projects/create/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      throw new Error('Failed to create project');
    }

    const result = await response.json();
    return result.data.project_id;
  };

  // Main submit handler
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError("");

    try {
      let projectId: string;

      if (mode === 'guest') {
        projectId = await handleGuestSubmit();
      } else {
        projectId = await handleUserSubmit();
      }

      // Navigate to user stories page with project ID
      navigate("/UserStoryPage", { 
        state: { 
          projectId,
          mode 
        } 
      });

    } catch (err) {
      setError("❌ Failed to save project. Please try again.");
      console.error("Submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateCompletion = (): number => {
    const fields = Object.values(formData);
    const filledFields = fields.filter(field => field.trim().length > 0).length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const completionPercentage = calculateCompletion();

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      <Header />

      <main className="flex-grow px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto animate-fade-in-up relative pb-32">
        {/* Title and Mode Indicator */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 font-medium text-center">
            {error}
          </div>
        )}

        {/* Form Sections */}
        <div className="space-y-6">
          {/* Main Goal */}
          <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              Main Goal <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              What is the primary objective of your project?
            </p>
            <textarea
              value={formData.goal}
              onChange={(e) => handleChange("goal", e.target.value)}
              placeholder="Ex: Help individuals manage their finances, track expenses, and make smarter investment decisions through AI-driven insights and automation."
              className="w-full p-4 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              rows={3}
            />
            <div className="text-xs text-gray-500 mt-1">
              {formData.goal.length}/500 characters
            </div>
          </section>

          {/* Users */}
          <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              Target Users <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              Who will be using this application?
            </p>
            <textarea
              value={formData.users}
              onChange={(e) => handleChange("users", e.target.value)}
              placeholder="Ex: Individual Users, Financial Advisors, Investment Managers, Administrators"
              className="w-full p-4 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              rows={2}
            />
          </section>

          {/* Features */}
          <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              Key Features <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              What are the main features of your application?
            </p>
            <textarea
              value={formData.fitur}
              onChange={(e) => handleChange("fitur", e.target.value)}
              placeholder="Ex: Automated expense tracking, AI-driven budgeting, personalized investment suggestions, financial reports, etc."
              className="w-full p-4 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              rows={3}
            />
          </section>

          {/* User Flow */}
          <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              User Flow <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              Describe the typical user journey through your application
            </p>
            <textarea
              value={formData.alur}
              onChange={(e) => handleChange("alur", e.target.value)}
              placeholder="Ex: User signs up → Links bank accounts → System tracks transactions → AI generates budget plan → User receives investment suggestions → Views progress dashboard"
              className="w-full p-4 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              rows={3}
            />
          </section>

          {/* Scope */}
          <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              Project Scope <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              What's included and what's not included in this project?
            </p>
            <textarea
              value={formData.scope}
              onChange={(e) => handleChange("scope", e.target.value)}
              placeholder="Ex: Focuses on personal finance and investment guidance for individuals. Does not include tax filing or professional financial advisory services."
              className="w-full p-4 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              rows={2}
            />
          </section>

          {/* Additional Information */}
          <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">
              Additional Information <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              Any other important details, constraints, or requirements?
            </p>
            <textarea
              value={formData.info}
              onChange={(e) => handleChange("info", e.target.value)}
              placeholder="Ex: Must comply with financial regulations, should work offline, needs to support multiple currencies, etc."
              className="w-full p-4 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              rows={2}
            />
          </section>
        </div>

        {/* Submit Button */}
        <div className="fixed bottom-6 right-6 sm:relative sm:bottom-auto sm:right-auto sm:mt-8 sm:text-right">
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