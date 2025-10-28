import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null); // semua FAQ tertutup

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "What types of diagrams can it generate?",
      answer: "StoryCanvas generates PlantUML Salt wireframes, which are visual representations of your user interface mockups. These diagrams show the structure and layout of your application pages.",
    },
    {
      question: "Do I need to know UML to use this?",
      answer: "Not at all. Just type your requirements in plain English, and our AI will translate them into professional diagrams for you.",
    },
    {
      question: "Can I edit the diagrams after they are generated?",
      answer: "Yes! You can edit user stories, wireframes, and test scenarios in our interactive editor. You can also regenerate specific elements if needed.",
    },
    {
      question: "Is it free?",
      answer: "We offer a free tier with basic features. Premium plans are available for advanced functionality and higher usage limits.",
    },
    {
      question: "How do you handle my data and privacy?",
      answer: "We take data privacy seriously. Your project data is encrypted and stored securely. We never share your information with third parties. You can delete your data at any time.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* HERO SECTION */}
      <section className="relative bg-gradient-to-r from-[#5F3D89] via-[#5561AA] to-[#4699DF] text-white overflow-hidden">
        {/* Wave bawah */}
        <div className="absolute bottom-0 left-0 w-full">
          <svg viewBox="0 0 1440 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" preserveAspectRatio="none">
            {/* Gelombang lembut dan rendah */}
            <path d="M0,120 Q360,200 720,120 T1440,120 L1440,200 L0,200 Z" fill="white" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-36 lg:py-48 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Kiri - teks */}
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">StoryCanvas</h1>
              <p className="text-base lg:text-lg opacity-95 leading-relaxed">
                Stop writing documentation the slow way. STORYCANVAS is the AI engine that turns your rough project ideas into professional, actionable blueprints instantly. Just enter your requirements, and our NLP and LLM pipeline
                automatically delivers INVEST User Stories, visual PlantUML Wireframes (PNG), and Gherkin Test Scenarios. Get standardized, high-quality documentation ready for your developers and QA team in minutes.
              </p>
              <div className="pt-4">
                <Link to="/chat" className="inline-flex items-center space-x-2 bg-white text-[#5561AA] px-6 py-3 rounded-full font-medium text-base hover:bg-opacity-95 transition shadow-lg">
                  <span>Try It Now</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Kanan - ilustrasi */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-md">
                <img src="/Logo_Story_Canvas.svg" alt="StoryCanvas Book and Lightbulb" className="w-full h-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          {/* Judul */}
          <div className="flex items-start space-x-4 mb-12">
            <img src="/vector_lampu.svg" alt="Lightbulb Icon" className="w-16 h-16 flex-shrink-0" />
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold text-[#5F3D89] leading-tight">How It Works:</h2>
              <p className="text-2xl text-[#5F3D89] font-semibold mt-2">From Idea to Artifacts in Minutes</p>
            </div>
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-white border-2 border-[#5F3D89] rounded-3xl p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Step 1:
                  <br />
                  <span className="text-xl">Tell Your Story</span>
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Simply type or paste your project requirements, goals, user roles, and key features into the Project Information Form. Don’t worry about structuring documentation — use natural language.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white border-2 border-[#5F3D89] rounded-3xl p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Step 2:
                  <br />
                  <span className="text-xl">AI Core Analysis (NLP & RAG)</span>
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">Our system immediately triggers the AI pipeline:</p>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>
                    • <strong>NLP (spaCy):</strong> Extracts key elements like Actors, Actions, and Entities.
                  </li>
                  <li>
                    • <strong>Domain Detection:</strong> Automatically identifies the project domain.
                  </li>
                  <li>
                    • <strong>RAG (ChromaDB):</strong> Retrieves the most relevant documentation patterns for high-quality output.
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white border-2 border-[#5F3D89] rounded-3xl p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Step 3:
                  <br />
                  <span className="text-xl">Auto-Generate Artifacts (LLM)</span>
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">The Large Language Model (LLM) then generates a full documentation suite:</p>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>
                    • <strong>INVEST User Stories</strong> with Acceptance Criteria.
                  </li>
                  <li>
                    • <strong>Visual Wireframes:</strong> Converts stories to HTML mockups, then to PlantUML Salt Diagrams (PNGs).
                  </li>
                  <li>
                    • <strong>Test Scenarios:</strong> Creates Gherkin (BDD) scenarios for QA.
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white border-2 border-[#5F3D89] rounded-3xl p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Step 4:
                  <br />
                  <span className="text-xl">Refine & Export</span>
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Review all generated artifacts in the interactive interface. Edit and regenerate elements as needed. Finally, export the complete structured documentation (stories, wireframes, and test files) as a single ZIP package.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left - FAQ */}
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
                  <button onClick={() => toggleFaq(index)} className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition">
                    <span className="font-semibold text-[#5F3D89] pr-4 text-base">{faq.question}</span>
                    <svg className={`w-5 h-5 text-[#5F3D89] transition-transform duration-300 flex-shrink-0 ${openFaq === index ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className={`transition-all duration-300 ease-in-out ${openFaq === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}>
                    <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed">{faq.answer}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right - FAQ Box */}
            <div className="lg:sticky lg:top-8">
              <div className="bg-[#E7EBFF] rounded-3xl p-12 text-center space-y-6">
                <p className="text-sm font-semibold text-[#5F3D89] uppercase tracking-wider">FAQ</p>
                <h2 className="text-5xl lg:text-6xl font-bold text-[#5F3D89] leading-tight">
                  Questions?
                  <br />
                  Look here.
                </h2>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
