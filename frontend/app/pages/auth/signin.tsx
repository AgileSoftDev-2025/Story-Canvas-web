import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { localStorageService } from "../../utils/localStorageService";

export default function SignIn() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Function to clear ALL localStorage data when signing out from scratch
  const clearAllLocalStorageData = () => {
    try {
      console.log("🧹 Clearing ALL localStorage data...");
      
      // Save auth data temporarily (if user is currently logged in)
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      const currentUser = localStorage.getItem('current_user');
      
      // Clear EVERYTHING
      localStorage.clear();
      console.log("✅ ALL localStorage cleared");
      
      // If we were logged in, the user is intentionally signing out
      // So we should NOT restore auth data
      // This ensures a clean slate when signing in fresh
      
      // Also clear sessionStorage for good measure
      sessionStorage.clear();
      
    } catch (err) {
      console.error("❌ Error clearing localStorage:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError("");
  };

  const validateForm = () => {
    if (!formData.username || !formData.password) {
      return "Username and password are required";
    }
    if (formData.password.length < 6) {
      return "Password must be at least 6 characters long";
    }
    return null;
  };

  // ✅ Handle Sign In with COMPLETE localStorage clearing
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("🔄 Attempting sign in...");
      
      // ✅ Clear ALL localStorage before sign in (fresh start)
      clearAllLocalStorageData();
      
      // ✅ Use the signIn method from AuthContext
      const result = await signIn(formData.username, formData.password);
      
      if (result.success) {
        console.log("✅ Login successful!");
        console.log("🔄 Redirecting to home...");
        navigate("/");
      } else {
        console.log("❌ Login failed:", result.error);
        setError(result.error || "Login failed");
      }
    } catch (err) {
      console.error("🚨 SignIn error:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpRedirect = () => {
    navigate("/signup");
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <Header />

      <main className="flex flex-grow min-h-[90vh]">
        {/* Left Section — Gradient Welcome */}
        <div className="w-1/2 flex flex-col justify-center items-start px-16 text-white bg-gradient animate-fade-in-up">
          <h1 className="text-6xl font-extrabold mb-4 leading-tight">
            WELCOME<br />BACK!
          </h1>
          <div className="w-16 h-1 bg-white rounded-full mb-6"></div>
          <p className="text-lg font-medium max-w-md">
            We're thrilled to see you again. Continue your journey<br />
            from imagination to visualization.
          </p>
        </div>

        {/* Right Section — Sign In Form */}
        <div className="w-1/2 flex flex-col justify-center items-center bg-white animate-fade-in-up">
          <div className="w-3/4 max-w-md">
            <h2 className="text-secondary font-bold text-2xl mb-2">StoryCanvas</h2>
            <h3 className="text-primary font-bold text-3xl mb-8">Sign In</h3>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                {error}
              </div>
            )}

            <form onSubmit={handleSignIn} className="flex flex-col space-y-6">
              <div>
                <label className="block text-primary mb-2 font-medium">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter Your Username"
                  className="w-full px-4 py-3 border border-primary-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                  required
                />
              </div>

              <div>
                <label className="block text-primary mb-2 font-medium">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter Your Password"
                  className="w-full px-4 py-3 border border-primary-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                  required
                  minLength={6}
                />
              </div>

              {/* ✅ Button dengan loading state */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 bg-primary text-white font-bold rounded-full transition hover-lift ${
                  loading 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:bg-primary-500"
                }`}
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-4">
              Doesn't have an account?{" "}
              <button 
                onClick={handleSignUpRedirect}
                className="text-primary hover:underline focus:outline-none"
              >
                Sign Up!
              </button>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}