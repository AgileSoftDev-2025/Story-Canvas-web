import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { RequireLoginPopup } from "./popup";
import { useAuth } from "../context/AuthContext";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  // ✅ Urutan yang benar: Home - Chat - History - About
  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Chat", path: "/chat" },
    { name: "About", path: "/about" },
  ];

  const authLinks = [
    { name: "SignIn", path: "/Signin" },
    { name: "SignUp", path: "/Signup" },
  ];

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      setMenuOpen(false);
      setDropdownOpen(false);
      console.log("✅ Logout successful, redirecting to home...");
      navigate("/");
    } catch (error) {
      console.error("❌ Logout error:", error);
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleHistoryClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      setShowPopup(true);
    }
  };

  return (
    <>
      <header className="bg-gradient-to-r from-[#5F3D89] via-[#5561AA] to-[#4699DF] text-white shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img src="/Logo_Story_Canvas.svg" alt="Logo" className="w-8 h-8" />
            <h1 className="text-xl font-semibold">StoryCanvas</h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {/* ✅ Home */}
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `transition ${
                  isActive
                    ? "opacity-100 border-b-2 border-white"
                    : "opacity-80 hover:opacity-100"
                }`
              }
            >
              Home
            </NavLink>

            {/* ✅ Chat */}
            <NavLink
              to="/chat"
              end
              className={({ isActive }) =>
                `transition ${
                  isActive
                    ? "opacity-100 border-b-2 border-white"
                    : "opacity-80 hover:opacity-100"
                }`
              }
            >
              Chat
            </NavLink>

            {/* ✅ History - Hilangkan underline ketika belum login */}
            {!isAuthenticated ? (
              // ✅ Ketika belum login - tanpa underline dan dengan hover effect
              <button
                onClick={handleHistoryClick}
                className="opacity-80 hover:opacity-100 transition cursor-pointer"
              >
                History
              </button>
            ) : (
              // ✅ Ketika sudah login - normal NavLink dengan underline aktif
              <NavLink
                to="/history"
                end
                className={({ isActive }) =>
                  `transition ${
                    isActive
                      ? "opacity-100 border-b-2 border-white"
                      : "opacity-80 hover:opacity-100"
                  }`
                }
              >
                History
              </NavLink>
            )}

            {/* ✅ About */}
            <NavLink
              to="/about"
              end
              className={({ isActive }) =>
                `transition ${
                  isActive
                    ? "opacity-100 border-b-2 border-white"
                    : "opacity-80 hover:opacity-100"
                }`
              }
            >
              About
            </NavLink>

            {/* ✅ Auth Section dengan real auth state */}
            {!isAuthenticated ? (
              <div className="flex items-center space-x-4">
                {authLinks.map((link) => (
                  <NavLink
                    key={link.name}
                    to={link.path}
                    className="bg-white text-[#4699DF] px-4 py-2 rounded-lg font-medium hover:bg-opacity-90 transition"
                  >
                    {link.name}
                  </NavLink>
                ))}
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 hover:opacity-80 transition"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 256 256"
                    fill="currentColor"
                  >
                    <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z" />
                  </svg>
                  <span>{user?.username || "User"}</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-lg z-50">
                    <button
                      onClick={handleLogout}
                      disabled={logoutLoading}
                      className={`w-full text-left px-4 py-3 transition rounded-lg ${
                        logoutLoading 
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                          : "hover:bg-gray-100"
                      }`}
                    >
                      {logoutLoading ? "Logging out..." : "Log Out"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* ✅ Popup muncul jika belum login */}
      {showPopup && <RequireLoginPopup onClose={() => setShowPopup(false)} />}
    </>
  );
}