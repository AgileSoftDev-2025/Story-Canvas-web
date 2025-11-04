import React from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";

export default function HistoryDetail() {
  const navigate = useNavigate();

  const handleExport = () => {
    navigate("/export");
  };

  // 🧩 Data contoh (bisa diganti dengan data dinamis nanti)
  const projectTitle = "Personal Finance Tracker App";
  const projectDate = "24 Jan 2025";

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      <Header />

      <main className="flex-grow container mx-auto px-6 py-10 max-w-5xl space-y-12 animate-fade-in-up">
        {/* 🔹 Header Section: Title + Date + Export Button */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {projectTitle}
            </h1>
            <p className="text-gray-500 text-sm mt-1">{projectDate}</p>
          </div>

          <button
            onClick={handleExport}
            className="mt-4 md:mt-0 bg-gradient-to-r from-[#5561AA] to-[#4699DF] text-white font-semibold px-6 py-2 rounded-lg shadow-md hover:opacity-90 transition"
          >
            Export
          </button>
        </div>

        {/* 🔹 Section 1: Detail Project */}
        <section className="rounded-2xl border border-gray-300 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-4 text-[#4699DF]">Detail Project</h2>
          <div className="space-y-3 text-gray-800 dark:text-gray-200">
            <p>
              <strong>User:</strong> “I want to create an app for personal finance tracking.”
            </p>
            <p>
              <strong>AI:</strong> “Great! What’s your main goal for the project?”
            </p>
            <p>
              <strong>User:</strong> “To help users manage spending and get AI investment advice.”
            </p>
            <p>
              <strong>AI:</strong> “Got it! Let's define user stories and scenarios.”
            </p>
          </div>
        </section>

        {/* 🔹 Section 2: User Story */}
        <section className="rounded-2xl border border-gray-300 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-4 text-[#4699DF]">User Story</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Individual Users</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>As an individual, I want to connect my bank accounts to monitor spending.</li>
                <li>As an individual, I want AI-based insights for saving and investing.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg">Financial Advisors</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>As an advisor, I want to track client portfolios for better recommendations.</li>
                <li>As an advisor, I want to offer premium consultation sessions.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 🔹 Section 3: Wireframe */}
        <section className="rounded-2xl border border-gray-300 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-4 text-[#4699DF]">Wireframe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((id) => (
              <div
                key={id}
                className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 shadow-sm hover:scale-[1.02] transition"
              >
                <img
                  src={`/assets/generated${id}.png`}
                  alt={`Wireframe ${id}`}
                  className="w-full h-auto object-contain"
                />
              </div>
            ))}
          </div>
        </section>

        {/* 🔹 Section 4: User Story Scenario */}
        <section className="rounded-2xl border border-gray-300 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-4 text-[#4699DF]">User Story Scenario</h2>

          <div className="rounded-xl border border-gray-200 p-5 space-y-6">
            {[1, 2, 3, 4].map((num) => (
              <div key={num}>
                <p className="font-semibold">Scenario {num}:</p>
                <p className="mt-1">
                  Given the individual users are on the related HTML page,
                  when they try to link their bank accounts,
                  then the system should respond appropriately.
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
