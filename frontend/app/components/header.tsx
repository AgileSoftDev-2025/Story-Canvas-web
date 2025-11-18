import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { RequireLoginPopup } from "./popup"; // ✅ Import popup

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false); // sementara manual
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false); // ✅ kontrol popup

  const userName = "Betari Safira";

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ];

  const authLinks = [
    { name: "SignIn", path: "/Signin" },
    { name: "SignUp", path: "/Signup" },
  ];

  const handleLogout = () => {
    setIsLoggedIn(false);
    setMenuOpen(false);
    setDropdownOpen(false);
  };

  const handleHistoryClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault(); // cegah routing
      setShowPopup(true); // tampilkan popup
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
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                end
                className={({ isActive }) =>
                  `transition ${
                    isActive
                      ? "opacity-100 border-b-2 border-white"
                      : "opacity-80 hover:opacity-100"
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}

            {/* Chat */}
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

            {/* ✅ History tetap muncul, tapi cek login */}
            <NavLink
              to={isLoggedIn ? "/history" : "#"}
              end
              onClick={handleHistoryClick}
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

            {/* Auth Section */}
            {!isLoggedIn ? (
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
                  <span>{userName}</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-lg z-50">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 hover:bg-gray-100 transition rounded-lg"
                    >
                      Log Out
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
