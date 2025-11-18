import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext"; // ✅ Import auth context

export default function SignUp() {
  const navigate = useNavigate();
  const { login } = useAuth(); // ✅ Gunakan auth context
  
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    passwordConfirmation: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    username: "",
    password: ""
  });

  // ✅ Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (error) setError("");
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  // ✅ Validasi form
  const validateForm = () => {
    const errors = {
      email: "",
      username: "",
      password: ""
    };

    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.username) {
      errors.username = "Username is required";
    } else if (formData.username.length < 3) {
      errors.username = "Username must be at least 3 characters long";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters long";
    }

    if (formData.password !== formData.passwordConfirmation) {
      errors.password = "Passwords do not match";
    }

    setFieldErrors(errors);

    // Check if there are any errors
    return Object.values(errors).some(error => error !== "");
  };

  // ✅ Extract specific field errors from backend response
  const extractFieldErrors = (errors: any) => {
    const fieldErrors = {
      email: "",
      username: "",
      password: ""
    };

    if (errors.email) {
      if (Array.isArray(errors.email)) {
        fieldErrors.email = errors.email[0];
      } else if (typeof errors.email === 'string') {
        fieldErrors.email = errors.email;
      } else if (errors.email.includes('already exists')) {
        fieldErrors.email = "Email has already been used";
      }
    }

    if (errors.username) {
      if (Array.isArray(errors.username)) {
        fieldErrors.username = errors.username[0];
      } else if (typeof errors.username === 'string') {
        fieldErrors.username = errors.username;
      } else if (errors.username.includes('already exists')) {
        fieldErrors.username = "Username has already been used";
      }
    }

    if (errors.password) {
      if (Array.isArray(errors.password)) {
        fieldErrors.password = errors.password[0];
      } else if (typeof errors.password === 'string') {
        fieldErrors.password = errors.password;
      }
    }

    return fieldErrors;
  };

  // ✅ Handle Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi client-side
    if (validateForm()) {
      return;
    }

    setLoading(true);
    setError("");
    setFieldErrors({ email: "", username: "", password: "" });

    try {
      console.log("🔄 Sending signup request...");
      
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

      console.log("📨 Response status:", response.status);
      
      const data = await response.json();
      console.log("📨 Response data:", data);

      // ✅ Handle response
      if (response.status === 201 && data.success) {
        console.log("✅ Registration successful!");
        
        // ✅ Gunakan login function dari context
        login(data.tokens, data.user);
        
        console.log("💾 Data saved via AuthContext");
        console.log("🔄 Redirecting to home...");
        
        navigate("/");
      } else {
        console.log("❌ Registration failed");
        
        // ✅ Handle field-specific errors from backend
        if (data.errors) {
          const extractedErrors = extractFieldErrors(data.errors);
          setFieldErrors(extractedErrors);
          
          // Also show general error if no specific field errors
          if (!Object.values(extractedErrors).some(error => error !== "")) {
            setError("Registration failed. Please check your input.");
          }
        } else if (data.error) {
          setError(data.error);
        } else {
          setError("Registration failed");
        }
      }
    } catch (err) {
      console.error("🚨 SignUp network error:", err);
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

            {/* General Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                {error}
              </div>
            )}

            {/* ✅ Form dengan handler */}
            <form onSubmit={handleSignUp} className="flex flex-col space-y-4">
              {/* Email */}
              <div>
                <label className="block text-primary mb-2 font-medium">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter Your Email"
                  className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                    fieldErrors.email 
                      ? "border-red-400 focus:ring-red-400" 
                      : "border-primary-200 focus:ring-primary-400"
                  }`}
                  required
                />
                {fieldErrors.email && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>
                )}
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
                  className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                    fieldErrors.username 
                      ? "border-red-400 focus:ring-red-400" 
                      : "border-primary-200 focus:ring-primary-400"
                  }`}
                  required
                />
                {fieldErrors.username && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.username}</p>
                )}
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
                  className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                    fieldErrors.password 
                      ? "border-red-400 focus:ring-red-400" 
                      : "border-primary-200 focus:ring-primary-400"
                  }`}
                  required
                  minLength={6}
                />
                {fieldErrors.password && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.password}</p>
                )}
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
                className={`w-full py-3 bg-primary text-white font-bold rounded-full transition hover-lift mt-4 ${
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