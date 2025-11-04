import React from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { DEFAULT_STORY, loadStory } from "./userstory-data";

export default function UserStoryPage() {
  const navigate = useNavigate();
  const story = loadStory();

  const handleEdit = () => {
    navigate("/UserStoryEditPage");
  };

  const handleAccept = () => {
    // Navigate to history after accepting, adjust as needed
    navigate("/WireframeGenerated");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <h1 className="mb-8 mt-4 text-4xl font-bold md:text-5xl">User Story</h1>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold underline">Individual Users</h2>
          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <ol className="list-decimal space-y-3 pl-6 whitespace-pre-wrap">
              {story.individual.split(/\r?\n/).map((line, idx) => (
                <li key={idx}>{line.replace(/^\d+\.\s*/, "")}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold underline">Financial Advisors</h2>
          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <ol className="list-decimal space-y-3 pl-6 whitespace-pre-wrap">
              {story.advisors.split(/\r?\n/).map((line, idx) => (
                <li key={idx}>{line.replace(/^\d+\.\s*/, "")}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold underline">Investment Managers</h2>
          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <ol className="list-decimal space-y-3 pl-6 whitespace-pre-wrap">
              {story.managers.split(/\r?\n/).map((line, idx) => (
                <li key={idx}>{line.replace(/^\d+\.\s*/, "")}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold underline">Administrators</h2>
          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <ol className="list-decimal space-y-3 pl-6 whitespace-pre-wrap">
              {story.admins.split(/\r?\n/).map((line, idx) => (
                <li key={idx}>{line.replace(/^\d+\.\s*/, "")}</li>
              ))}
            </ol>
          </div>
        </section>

        <div className="flex items-center justify-end gap-4 pb-6">
          <button
            onClick={handleEdit}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-[#4699DF] shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            Edit
          </button>
          <button
            onClick={handleAccept}
            className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 font-medium text-white shadow-sm transition hover:opacity-95"
          >
            Accept
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
