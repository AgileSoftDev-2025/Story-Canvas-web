import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";

export default function SignIn() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError("");
  };

  // ✅ Validasi form
  const validateForm = () => {
    if (!formData.username || !formData.password) {
      return "Username and password are required";
    }
    if (formData.password.length < 6) {
      return "Password must be at least 6 characters long";
    }
    return null;
  };

  // ✅ Fungsi handle login dengan backend integration
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
      console.log("🔄 Sending signin request...");
      
      const response = await fetch("http://127.0.0.1:8000/api/auth/signin/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      console.log("📨 Response status:", response.status);
      
      // Cek content type sebelum parse
      const contentType = response.headers.get("content-type");
      console.log("📨 Content-Type:", contentType);
      
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
        console.log("📨 Response data:", data);
      } else {
        const text = await response.text();
        console.log("📨 Raw text response:", text);
        setError("Server returned non-JSON response");
        return;
      }

      // ✅ Handle response
      if (response.ok && data.success) {
        console.log("✅ Login successful!");
        
        // Simpan tokens dan user data
        localStorage.setItem("access_token", data.tokens.access);
        localStorage.setItem("refresh_token", data.tokens.refresh);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        console.log("💾 Data saved to localStorage");
        console.log("🔄 Redirecting to dashboard...");
        
        // Redirect ke dashboard
        navigate("/");
      } else {
        console.log("❌ Login failed");
        // Handle error
        let errorMessage = "Login failed";
        if (data.error) {
          errorMessage = data.error;
        } else if (data.errors) {
          errorMessage = Object.values(data.errors).flat().join(', ');
        }
        setError(errorMessage);
      }
    } catch (err) {
      console.error("🚨 SignIn network error:", err);
      setError("Network error. Please check if server is running.");
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk langsung ke Sign Up
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