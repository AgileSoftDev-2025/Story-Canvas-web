import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";

export default function EditWireframe() {
  const navigate = useNavigate();

  const [wireframes] = useState([
    {
      id: 1,
      image: "/assets/generated1.png",
      html: "<div class='hero'><h1>Welcome to our Herbal Tea Shop</h1></div>",
    },
    {
      id: 2,
      image: "/assets/generated2.png",
      html: "<section><p>Our newest teas and bundles!</p></section>",
    },
  ]);

  const [activeAI, setActiveAI] = useState(false);
  const [selectedHtml, setSelectedHtml] = useState("");

  const toggleAI = (html: string) => {
    setSelectedHtml(html);
    setActiveAI(!activeAI);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSubmit = () => {
    alert("Wireframe telah disubmit!");
    navigate("/WireframeGenerated");
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-800">
      <Header />

      <main className="container mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8 mt-4">
          <h1 className="text-4xl font-bold md:text-5xl">Edit Wireframes</h1>
          <button
            onClick={handleBack}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-[#4699DF] shadow-sm transition hover:bg-gray-50"
          >
            Back
          </button>
        </div>

        {/* Wireframe Section */}
        <div className="space-y-10 overflow-y-auto max-h-[75vh] pr-2">
          {wireframes.map((wf) => (
            <div
              key={wf.id}
              className="p-6 rounded-2xl border border-gray-300 bg-white shadow-sm space-y-5"
            >
              {/* Wireframe Image */}
              <div>
                <h2 className="text-xl font-semibold mb-3 underline">
                  Wireframe {wf.id}
                </h2>
                <img
                  src={wf.image}
                  alt={`Wireframe ${wf.id}`}
                  className="w-full rounded-lg border border-gray-300"
                />
              </div>

              {/* HTML Editor */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  HTML Code
                </label>
                <textarea
                  defaultValue={wf.html}
                  className="w-full h-40 p-3 rounded-md border border-gray-300 bg-gray-50 font-mono text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                ></textarea>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  Preview
                </label>
                <div
                  className="border border-gray-300 p-4 rounded-md bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: wf.html }}
                />
              </div>

              {/* AI Helper */}
              <div className="flex justify-end">
                <button
                  onClick={() => toggleAI(wf.html)}
                  className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 font-medium text-white shadow-sm transition hover:opacity-95"
                >
                  Bantu dengan AI
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
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg relative border border-gray-200">
              <button
                onClick={() => setActiveAI(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>

              <h2 className="text-xl font-semibold mb-3 underline">Bantuan AI</h2>

              <div className="border border-gray-300 rounded-md h-60 p-3 overflow-y-auto bg-gray-50">
                <p className="text-gray-500 italic">
                  (Placeholder) Chat AI akan muncul di sini untuk membantu
                  memperbaiki HTML atau memberikan saran desain.
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik pesan ke AI..."
                  className="flex-grow p-2 rounded-md border border-gray-300 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-5 py-2 font-medium text-white shadow-sm transition hover:opacity-95">
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
