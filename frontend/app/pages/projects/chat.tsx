// frontend/src/pages/onboarding/input-project.tsx
import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";

export default function InputProject() {
  const navigate = useNavigate();

  // State for each input field
  const [formData, setFormData] = useState({
    goal: "",
    users: "",
    fitur: "",
    alur: "",
    scope: "",
    info: "",
  });

  const [error, setError] = useState("");

  // Handle text change
  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(""); // clear error when typing
  };

  // Validate before navigating
  const handleSubmit = () => {
    const { goal, users, fitur, alur, scope, info } = formData;
    if (!goal || !users || !fitur || !alur || !scope || !info) {
      setError("⚠️ Please fill in all fields before proceeding.");
      return;
    }

    // If all filled, go to next page
    navigate("/UserStoryPage");
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      <Header />

      <main className="flex-grow px-8 py-10 max-w-4xl mx-auto animate-fade-in-up relative pb-32">
        {/* Title */}
        <h1 className="text-4xl font-extrabold mb-10 text-center text-gray-900 dark:text-gray-100">
          INPUT YOUR PROJECT DESCRIPTION!
        </h1>

        {/* Error Message */}
        {error && (
          <div className="mb-6 text-red-600 font-medium text-center">
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
            className="w-full p-3 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={3}
          />
        </section>

        {/* Users */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Users</h2>
          <textarea
            value={formData.users}
            onChange={(e) => handleChange("users", e.target.value)}
            placeholder="Ex: Individual Users, Financial Advisors, Investment Managers, Administrators"
            className="w-full p-3 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={2}
          />
        </section>

        {/* Fitur */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Fitur</h2>
          <textarea
            value={formData.fitur}
            onChange={(e) => handleChange("fitur", e.target.value)}
            placeholder="Ex: Automated expense tracking, AI-driven budgeting, personalized investment suggestions, etc."
            className="w-full p-3 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={3}
          />
        </section>

        {/* Alur */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Alur</h2>
          <textarea
            value={formData.alur}
            onChange={(e) => handleChange("alur", e.target.value)}
            placeholder="Ex: User links bank accounts → System tracks transactions → AI generates budget plan → ..."
            className="w-full p-3 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
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
            className="w-full p-3 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
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
            className="w-full p-3 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            rows={2}
          />
        </section>

        {/* Submit Button */}
        <div className="absolute bottom-10 right-12">
          <button
            onClick={handleSubmit}
            className="bg-gradient text-white font-semibold px-8 py-3 rounded-full shadow-md inline-block hover-lift transition"
          >
            Submit Project
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
