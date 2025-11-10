import React, { useEffect, useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";

export default function WireframeGenerated() {
  const navigate = useNavigate();

  // contoh data PNG yang nanti bisa berasal dari API
  const [generatedImages] = useState([
    { id: 1, src: "/assets/generated1.png" },
    { id: 2, src: "/assets/generated2.png" },
    { id: 3, src: "/assets/generated3.png" },
  ]);

  // progress bar state
  const [progress, setProgress] = useState(0);

  // simulasi proses generate LLM
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const handleAccept = () => {
    // Arahkan ke halaman berikutnya setelah menerima hasil wireframe
    navigate("/HasilGenerate");
  };

  const handleEdit = () => {
    navigate("/EditWireframe");
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-800">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {/* Title */}
        <h1 className="mb-4 mt-4 text-4xl font-bold md:text-5xl">
          Wireframe Results
        </h1>

        {/* Progress Bar */}
        <div className="mb-10 w-full bg-gray-200 rounded-full h-5 overflow-hidden relative shadow-inner">
          <div
            className="absolute left-0 top-0 h-5 bg-gradient-to-r from-[#5561AA] to-[#4699DF] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow-sm">
            Process Generate LLM ({progress}%)
          </span>
        </div>

        {/* Generated Wireframes */}
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold underline">
            Generated Wireframes
          </h2>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {generatedImages.map((img) => (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm transition hover:scale-[1.02]"
                >
                  <img
                    src={img.src}
                    alt={`Generated Wireframe ${img.id}`}
                    className="w-full h-auto object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pb-6">
          <button
            onClick={handleEdit}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-[#4699DF] shadow-sm transition hover:bg-gray-50"
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
