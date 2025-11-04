import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";

export default function UserStoryScenarioEdit() {
  const navigate = useNavigate();

  const [scenarios, setScenarios] = useState([
    `Scenario 1:
Scenario: link my bank accounts when HTML structure is missing or malformed
Given the individual user is on the related HTML page
When the individual user tries to perform a link my bank accounts
Then the system should handle gracefully
And provide explicit fallbacks, default components, or instructions to the user`,

    `Scenario 2:
Scenario: link my bank accounts fails due to hidden, unbalanced, or malformed elements
Given the individual user is on the related HTML page
And the page is assumed to have form fields, buttons, links
When the individual user tries to interact but elements are invisible, local blocks, or have wrong roles
Then the system should notify the user about system failure`,

    `Scenario 3:
Scenario: link my bank accounts interrupted due to dynamic or lazy UI loading
Given the individual user is on the related HTML page
And the page is assumed to have form fields, buttons, links
When expected elements load asynchronously or fail to appear
Then the system should retry, reload loading indicator, or present an error`,

    `Scenario 4:
Scenario: Successful link my bank accounts
Given the individual user is on the related HTML page
And the page is assumed to have form fields, buttons, links
When the individual user interacts correctly with form fields, buttons, links
Then the system should complete link my bank accounts successfully
And when individual users achieves the goal the system can automatically track and categorize my transactions`,

    `Scenario 5:
Scenario: Failed link my bank accounts due to invalid input
Given the individual user is on the related HTML page
And the page is assumed to have form fields, buttons, links
When the individual user provides invalid or missing data in form fields, buttons, links
Then the system should reject the action
And show an error message explaining the problem`,

    `Scenario 6:
Scenario: link my bank accounts with boundary values
Given the individual user is on the related HTML page
And the page is assumed to have form fields, buttons, links
When the individual user enters extreme or unexpected input (max length, special chars, empty) in form fields, buttons, links
Then the system should validate and respond accordingly`,

    `Scenario 7:
Scenario: unauthorized link my bank accounts
Given an unauthorized individual user attempts to access the feature
When they try to perform link my bank accounts
Then the system should deny access
And log the attempt with sufficient details`,

    `Scenario 8:
Scenario: link my bank accounts fails due to system error
Given the individual user is on the related HTML page
When the system encounters database error during link my bank accounts
Then the system should notify the individual users
And suggest retrying later or provide offline fallback`,
  ]);

  const [activeAI, setActiveAI] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);

  const handleBack = () => {
    navigate(-1);
  };

  const handleSubmit = () => {
    console.log("User story scenarios submitted:", scenarios);
    navigate("/UserStoryScenario");
  };

  const toggleAI = (index: number) => {
    setSelectedScenario(index);
    setActiveAI(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8 mt-4">
          <h1 className="text-4xl font-bold md:text-5xl">
            Edit User Story Scenario
          </h1>
          <button
            onClick={handleBack}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-[#4699DF] shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            Back
          </button>
        </div>

        {/* Scenario Editing Section */}
        <div className="space-y-8 overflow-y-auto max-h-[70vh] pr-2">
          {scenarios.map((scenario, index) => (
            <div
              key={index}
              className="rounded-2xl border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 p-6 space-y-4"
            >
              <h2 className="text-xl font-semibold underline">
                Scenario {index + 1}
              </h2>

              <textarea
                value={scenario}
                onChange={(e) => {
                  const updated = [...scenarios];
                  updated[index] = e.target.value;
                  setScenarios(updated);
                }}
                className="w-full h-40 p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono text-sm text-gray-800 dark:text-gray-100"
              ></textarea>

              <div className="flex justify-end">
                <button
                  onClick={() => toggleAI(index)}
                  className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 font-medium text-white shadow-sm transition hover:opacity-95"
                >
                  Bantuan AI
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end mt-10 pb-6">
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-8 py-2 font-medium text-white shadow-sm transition hover:opacity-95"
          >
            Submit
          </button>
        </div>

        {/* AI Popup */}
        {activeAI && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-xl w-full max-w-lg relative border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveAI(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>

              <h2 className="text-xl font-semibold mb-3 underline">
                Bantuan AI
              </h2>

              <div className="border border-gray-300 dark:border-gray-700 rounded-md h-60 p-3 overflow-y-auto bg-gray-50 dark:bg-gray-800">
                <p className="text-gray-500 italic">
                  (Placeholder) Chat AI akan muncul di sini untuk membantu
                  memperbaiki skenario atau memberikan saran penulisan.
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik pesan ke AI..."
                  className="flex-grow p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={() => setActiveAI(false)}
                  className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-5 py-2 font-medium text-white shadow-sm transition hover:opacity-95"
                >
                  Kirim
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
