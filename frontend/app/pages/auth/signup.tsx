import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    passwordConfirmation: ""
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
    if (!formData.email || !formData.username || !formData.password) {
      return "All fields are required";
    }
    if (formData.password.length < 6) {
      return "Password must be at least 6 characters long";
    }
    if (formData.password !== formData.passwordConfirmation) {
      return "Passwords do not match";
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      return "Please enter a valid email address";
    }
    return null;
  };

  // ✅ ✅ ✅ PERBAIKAN: Fixed handleSignUp function
  const handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const validationError = validateForm();
  if (validationError) {
    setError(validationError);
    return;
  }

  setLoading(true);
  setError("");

  try {
    console.log("🔄 [1] Sending signup request...");
    
    const response = await fetch("http://127.0.0.1:8000/api/auth/signup/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        password_confirm: formData.passwordConfirmation,
      }),
    });

    console.log("📨 [2] Response status:", response.status);
    console.log("📨 [3] Response headers:", Object.fromEntries(response.headers.entries()));
    
    // ✅ Cek content type sebelum parse
    const contentType = response.headers.get("content-type");
    console.log("📨 [4] Content-Type:", contentType);
    
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
      console.log("📨 [5] JSON data:", data);
    } else {
      const text = await response.text();
      console.log("📨 [5] Raw text response:", text);
      setError("Server returned non-JSON response");
      return;
    }

    console.log("🔍 [6] Checking response data...");
    console.log("🔍 [7] data.success:", data.success);
    console.log("🔍 [8] data.tokens:", data.tokens);
    console.log("🔍 [9] data.user:", data.user);

    // ✅ CHECK YANG LEBIH ROBUST
    if (response.status === 201 && data.success === true) {
      console.log("✅ [10] Registration successful!");
      
      if (data.tokens && data.tokens.access) {
        localStorage.setItem("access_token", data.tokens.access);
        localStorage.setItem("refresh_token", data.tokens.refresh);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        console.log("💾 [11] Data saved to localStorage");
        console.log("🔄 [12] Redirecting to dashboard...");
        
        navigate("/Signin");
      } else {
        console.log("❌ [13] Missing tokens in response");
        setError("Registration successful but missing tokens");
      }
    } else {
      console.log("❌ [14] Registration failed");
      console.log("❌ [15] data.error:", data.error);
      console.log("❌ [16] data.errors:", data.errors);
      
      let errorMessage = "Registration failed";
      if (data.errors) {
        errorMessage = Object.values(data.errors).flat().join(', ');
      } else if (data.error) {
        errorMessage = data.error;
      }
      setError(errorMessage);
    }
  } catch (err) {
    console.error("🚨 [17] SignUp network error:", err);
    setError("Network error. Please check if server is running.");
  } finally {
    setLoading(false);
  }
};

  // Fungsi untuk langsung ke Sign In
  const handleSignInRedirect = () => {
    navigate("/Signin");
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <Header />

      <main className="flex flex-grow min-h-[100vh]">
        {/* Left Section — Gradient Welcome */}
        <div className="w-1/2 flex flex-col justify-center items-start px-16 text-white bg-gradient animate-fade-in-up">
          <h1 className="text-6xl font-extrabold mb-4 leading-tight">
            WELCOME!
          </h1>
          <div className="w-16 h-1 bg-white rounded-full mb-6"></div>
          <p className="text-lg font-medium max-w-md">
            Where your ideas transform into visual stories. Begin<br />
            your journey from concept to clarity.
          </p>
        </div>

        {/* Right Section — Sign Up Form */}
        <div className="w-1/2 flex flex-col justify-center items-center bg-white animate-fade-in-up">
          <div className="w-3/4 max-w-md">
            <h2 className="text-secondary font-bold text-2xl mb-2">StoryCanvas</h2>
            <h3 className="text-primary font-bold text-3xl mb-8">Sign Up</h3>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                {error}
              </div>
            )}

            {/* ✅ Form dengan handler */}
            <form onSubmit={handleSignUp} className="flex flex-col space-y-6">
              {/* Email */}
              <div>
                <label className="block text-primary mb-2 font-medium">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter Your Email"
                  className="w-full px-4 py-3 border border-primary-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                  required
                />
              </div>

              {/* Username */}
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

              {/* Password */}
              <div>
                <label className="block text-primary mb-2 font-medium">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter Your Password (min. 6 characters)"
                  className="w-full px-4 py-3 border border-primary-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                  required
                  minLength={6}
                />
              </div>

              {/* Password Confirmation */}
              <div>
                <label className="block text-primary mb-2 font-medium">Password Confirmation</label>
                <input
                  type="password"
                  name="passwordConfirmation"
                  value={formData.passwordConfirmation}
                  onChange={handleInputChange}
                  placeholder="Re-enter Your Password"
                  className="w-full px-4 py-3 border border-primary-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                  required
                />
              </div>

              {/* ✅ Tombol Sign Up */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 bg-primary text-white font-bold rounded-full transition hover-lift ${
                  loading 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:bg-primary-500"
                }`}
              >
                {loading ? "Creating Account..." : "Sign Up"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-4">
              Already have an account?{" "}
              <button 
                onClick={handleSignInRedirect}
                className="text-primary hover:underline focus:outline-none"
              >
                Sign In!
              </button>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}