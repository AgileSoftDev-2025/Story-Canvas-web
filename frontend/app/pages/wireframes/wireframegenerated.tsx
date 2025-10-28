import React, { useState } from "react";
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

  const handleAccept = () => {
    // Arahkan ke halaman berikutnya setelah menerima hasil wireframe
     navigate("/HasilGenerate");
  };

  const handleEdit = () => {
    navigate("/EditWireframe");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <h1 className="mb-8 mt-4 text-4xl font-bold md:text-5xl">
          Wireframe Results
        </h1>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold underline">
            Generated Wireframes
          </h2>

          <div className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {generatedImages.map((img) => (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm transition hover:scale-[1.02] dark:border-gray-700 dark:bg-gray-800"
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
