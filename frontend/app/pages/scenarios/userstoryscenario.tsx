import React from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";

export default function UserStoryScenario() {
  const navigate = useNavigate();

  const handleAccept = () => {
    // Navigate or process here without alert
    navigate("/Export");};

  const handleEdit = () => {
    navigate("/UserStoryScenarioEdit");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <h1 className="mb-4 mt-4 text-4xl font-bold md:text-5xl">
          User Story Scenario
        </h1>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">Individual Users</h2>
          <p className="mb-5 text-gray-600 dark:text-gray-300">
            Individual_Users_story_1 (Individual Users)
          </p>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-col gap-4 whitespace-pre-line text-gray-800 dark:text-gray-200 overflow-y-auto max-h-[70vh] px-2">
              {[
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
              ].map((scenario, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
                >
                  <pre className="whitespace-pre-wrap font-sans">{scenario}</pre>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4 pb-6">
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
