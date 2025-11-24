import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function SignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
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
  const [touchedFields, setTouchedFields] = useState({
    email: false,
    username: false,
    password: false,
    passwordConfirmation: false
  });

  // ✅ Password validation rules - return array of errors
  const validatePassword = (password: string) => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
      errors.push("Password must contain at least one symbol");
    }

    return errors;
  };

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

  // ✅ Handle field blur (when user leaves the field)
  const handleFieldBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    setTouchedFields(prev => ({
      ...prev,
      [name]: true
    }));

    // Validate the field that was just blurred
    validateField(name, formData[name as keyof typeof formData]);
  };

  // ✅ Validate individual field
  const validateField = (fieldName: string, value: string) => {
    const errors = { ...fieldErrors };

    if (fieldName === 'email') {
      if (!value) {
        errors.email = "Email is required";
      } else if (!/\S+@\S+\.\S+/.test(value)) {
        errors.email = "Please enter a valid email address";
      } else {
        errors.email = "";
      }
    }

    if (fieldName === 'username') {
      if (!value) {
        errors.username = "Username is required";
      } else if (value.length < 3) {
        errors.username = "Username must be at least 3 characters long";
      } else {
        errors.username = "";
      }
    }

    if (fieldName === 'password') {
      if (!value) {
        errors.password = "Password is required";
      } else {
        const passwordErrors = validatePassword(value);
        if (passwordErrors.length > 0) {
          // ✅ Combine multiple password errors
          if (passwordErrors.length === 1) {
            errors.password = passwordErrors[0];
          } else {
            // Group similar errors
            const numberError = passwordErrors.find(err => err.includes('number'));
            const symbolError = passwordErrors.find(err => err.includes('symbol'));
            const lowercaseError = passwordErrors.find(err => err.includes('lowercase'));
            const uppercaseError = passwordErrors.find(err => err.includes('uppercase'));
            const lengthError = passwordErrors.find(err => err.includes('8 characters'));

            // Create combined messages
            const combinedErrors = [];
            if (numberError && symbolError) {
              combinedErrors.push("Password must contain at least one number and one symbol");
            } else if (lowercaseError && uppercaseError) {
              combinedErrors.push("Password must contain at least one lowercase and one uppercase letter");
            } else {
              // Show up to 2 specific errors
              combinedErrors.push(...passwordErrors.slice(0, 2));
            }

            errors.password = combinedErrors.join(', ');
          }
        } else {
          errors.password = "";
        }
      }
    }

    if (fieldName === 'passwordConfirmation') {
      // This will be handled in the main validation
    }

    setFieldErrors(errors);
  };

  // ✅ Validasi form untuk submit
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

    // ✅ Enhanced password validation
    if (!formData.password) {
      errors.password = "Password is required";
    } else {
      const passwordErrors = validatePassword(formData.password);
      if (passwordErrors.length > 0) {
        // Combine multiple errors for form submission
        if (passwordErrors.length > 1) {
          errors.password = `Password requirements not met: ${passwordErrors.slice(0, 2).join(', ')}`;
        } else {
          errors.password = passwordErrors[0];
        }
      }
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

  // ✅ Password strength indicator
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, color: "bg-gray-200" };
    
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/(?=.*[a-z])/.test(password)) strength += 1;
    if (/(?=.*[A-Z])/.test(password)) strength += 1;
    if (/(?=.*\d)/.test(password)) strength += 1;
    if (/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) strength += 1;

    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-yellow-500", 
      "bg-blue-500",
      "bg-green-500"
    ];

    return {
      strength,
      color: colors[strength - 1] || "bg-gray-200",
      percentage: (strength / 5) * 100
    };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  // ✅ Handle Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched when submitting
    setTouchedFields({
      email: true,
      username: true,
      password: true,
      passwordConfirmation: true
    });

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

  // ✅ Helper to show field error only if touched
  const shouldShowError = (fieldName: keyof typeof touchedFields) => {
    return touchedFields[fieldName] && fieldErrors[fieldName as keyof typeof fieldErrors];
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
                  onBlur={handleFieldBlur}
                  placeholder="Enter Your Email"
                  className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                    shouldShowError('email') 
                      ? "border-red-400 focus:ring-red-400" 
                      : "border-primary-200 focus:ring-primary-400"
                  }`}
                  required
                />
                {shouldShowError('email') && (
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
                  onBlur={handleFieldBlur}
                  placeholder="Enter Your Username"
                  className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                    shouldShowError('username') 
                      ? "border-red-400 focus:ring-red-400" 
                      : "border-primary-200 focus:ring-primary-400"
                  }`}
                  required
                />
                {shouldShowError('username') && (
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
                  onBlur={handleFieldBlur}
                  placeholder="Enter Your Password (min. 8 characters)"
                  className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                    shouldShowError('password') 
                      ? "border-red-400 focus:ring-red-400" 
                      : "border-primary-200 focus:ring-primary-400"
                  }`}
                  required
                  minLength={8}
                />
                
                {/* ✅ Password Strength Indicator */}
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Password strength:</span>
                      <span>{passwordStrength.strength}/5</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* ✅ Password Requirements */}
                <div className="mt-2 text-xs text-gray-600">
                  <p className="font-medium mb-1">Password must contain:</p>
                  <ul className="space-y-1">
                    <li className={`flex items-center ${formData.password.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="mr-1">{formData.password.length >= 8 ? '✓' : '○'}</span>
                      At least 8 characters
                    </li>
                    <li className={`flex items-center ${/(?=.*[a-z])/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="mr-1">{/(?=.*[a-z])/.test(formData.password) ? '✓' : '○'}</span>
                      One lowercase letter
                    </li>
                    <li className={`flex items-center ${/(?=.*[A-Z])/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="mr-1">{/(?=.*[A-Z])/.test(formData.password) ? '✓' : '○'}</span>
                      One uppercase letter
                    </li>
                    <li className={`flex items-center ${/(?=.*\d)/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="mr-1">{/(?=.*\d)/.test(formData.password) ? '✓' : '○'}</span>
                      One number
                    </li>
                    <li className={`flex items-center ${/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="mr-1">{/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(formData.password) ? '✓' : '○'}</span>
                      One symbol
                    </li>
                  </ul>
                </div>

                {shouldShowError('password') && (
                  <p className="text-red-500 text-sm mt-2">{fieldErrors.password}</p>
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
                  onBlur={handleFieldBlur}
                  placeholder="Re-enter Your Password"
                  className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                    touchedFields.passwordConfirmation && formData.password !== formData.passwordConfirmation
                      ? "border-red-400 focus:ring-red-400" 
                      : "border-primary-200 focus:ring-primary-400"
                  }`}
                  required
                />
                {touchedFields.passwordConfirmation && formData.password !== formData.passwordConfirmation && (
                  <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                )}
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