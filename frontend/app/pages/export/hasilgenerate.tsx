import React, { useState, useEffect } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { useNavigate } from "react-router-dom";

export default function HasilGenerate() {
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  // === Progress Bar ===
  const [progress, setProgress] = useState(0);
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

  // === Konten utama ===
  const [content, setContent] = useState(`User Story 1 – Login dan Pembuatan Akun
Sebagai pengguna baru, saya ingin dapat membuat akun agar saya bisa masuk ke sistem dan menggunakan fitur-fitur yang tersedia.

Scenario 1:
Scenario: Pengguna berhasil membuat akun baru
Given pengguna membuka halaman pendaftaran
When pengguna mengisi semua data dengan benar dan klik "Daftar"
Then sistem menyimpan data pengguna dan menampilkan pesan "Pendaftaran berhasil"

Scenario 2:
Scenario: Pengguna gagal membuat akun karena email sudah digunakan
Given pengguna mengisi formulir dengan email yang sudah terdaftar
When pengguna klik "Daftar"
Then sistem menampilkan pesan "Email sudah digunakan" dan meminta pengguna login

Scenario 3:
Scenario: Pengguna login dengan akun yang valid
Given pengguna membuka halaman login
When pengguna memasukkan email dan password yang benar
Then sistem mengarahkan ke dashboard utama


User Story 2 – Menggunakan Fitur AI untuk Menulis Cerita
Sebagai pengguna yang sudah login, saya ingin menggunakan fitur AI agar bisa membantu menulis dan memperbaiki cerita saya.

Scenario 1:
Scenario: Pengguna membuka fitur AI dan memasukkan prompt
Given pengguna berada di halaman “Hasil Generate”
When pengguna klik tombol "Butuh bantuan AI?" dan mengetik instruksi
Then sistem AI memproses input dan menampilkan saran di area hasil

Scenario 2:
Scenario: Pengguna menerapkan hasil saran AI
Given AI sudah memberikan saran di jendela pop-up
When pengguna klik tombol “Terapkan ke Editor”
Then isi editor diperbarui dengan saran AI terbaru
`);

  // Pisahkan setiap User Story
  const userStories = content
    .split(/(?=User Story \d+)/g)
    .filter((s) => s.trim().length > 0);

  // === State untuk expand/collapse ===
  const [expanded, setExpanded] = useState<boolean[]>(
    new Array(userStories.length).fill(false)
  );

  const toggleExpand = (index: number) => {
    setExpanded((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  // === Saat edit per user story ===
  const [editableStories, setEditableStories] = useState(userStories);

  useEffect(() => {
    if (isEditing) {
      setEditableStories(userStories);
    }
  }, [isEditing]);

  const handleStoryChange = (index: number, newText: string) => {
    const updated = [...editableStories];
    updated[index] = newText;
    setEditableStories(updated);
  };

  const handleSave = () => {
    setContent(editableStories.join("\n\n"));
    setIsEditing(false);
  };

  // === Fitur Bantuan AI ===
  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const sendToAI = async () => {
    if (!aiInput.trim()) return;
    const msg = aiInput.trim();
    setAiMessages((m) => [...m, { role: "user", content: msg }]);
    setAiBusy(true);

    // Dummy AI response
    setTimeout(() => {
      const response =
        "AI Suggestion: mungkin tambahkan skenario validasi tambahan di akhir.";
      setAiMessages((m) => [...m, { role: "assistant", content: response }]);
      setAiBusy(false);
      setAiInput("");
    }, 1000);
  };

  const applyLastSuggestion = () => {
    const last = [...aiMessages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    setContent((prev) => prev + "\n\n" + last.content);
    setShowAI(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f9fafb]">
      <Header />

      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto bg-white shadow-md rounded-xl p-6">
          {/* Judul dan tombol AI */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-[#3E4766]">
              User Story Scenario
            </h1>
            <button
              onClick={() => setShowAI(true)}
              className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
            >
              Butuh bantuan AI?
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 bg-gradient-to-r from-[#5561AA] to-[#4699DF] transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-1">{progress}%</p>
          </div>

          {/* Konten utama */}
          <div className="space-y-6">
            {isEditing
              ? editableStories.map((story, i) => (
                  <div
                    key={i}
                    className="border border-gray-300 rounded-xl bg-gray-50 p-4 shadow-sm"
                  >
                    <h2 className="text-lg font-semibold text-[#3E4766] mb-2">
                      {story.split("\n")[0]}
                    </h2>
                    <textarea
                      value={story}
                      onChange={(e) =>
                        handleStoryChange(i, e.target.value)
                      }
                      className="w-full h-[250px] border border-gray-300 rounded-lg p-3 text-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#5561AA]"
                    />
                  </div>
                ))
              : userStories.map((story, i) => {
                  const lines = story.trim().split("\n");
                  const preview = lines.slice(0, 3).join("\n");
                  return (
                    <div
                      key={i}
                      className="border border-gray-300 rounded-xl bg-gray-50 p-4 shadow-sm"
                    >
                      <h2 className="text-lg font-semibold text-[#3E4766] mb-2">
                        {lines[0]}
                      </h2>
                      <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap">
                        {expanded[i] ? story.trim() : preview + " ..."}
                      </pre>
                      <button
                        onClick={() => toggleExpand(i)}
                        className="mt-3 text-sm font-medium text-[#4699DF] hover:underline"
                      >
                        {expanded[i]
                          ? "Sembunyikan"
                          : "Lihat Selengkapnya"}
                      </button>
                    </div>
                  );
                })}
          </div>

          {/* Tombol bawah */}
          <div className="flex justify-end gap-3 mt-8">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg px-5 py-2 font-medium
                            text-[#5561AA] bg-white border-2 border-[#5561AA]
                            hover:bg-gray-100 transition-colors shadow-sm"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-5 py-2 text-white font-medium shadow-sm hover:opacity-95"
              >
                Save
              </button>
            )}

            <button
              onClick={() => navigate("/PreviewFinal")}
              className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-5 py-2 text-white font-medium shadow-sm hover:opacity-95"
            >
              Accept
            </button>
          </div>
        </div>
      </main>

      {/* === Popup Bantuan AI === */}
      {showAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                Butuh bantuan AI?
              </h3>
              <button
                onClick={() => setShowAI(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Instruksi
              </label>
              <div className="flex gap-2">
                <input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Contoh: perbaiki grammar atau ringkas kalimat."
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5561AA]"
                />
                <button
                  onClick={sendToAI}
                  disabled={aiBusy}
                  className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {aiBusy ? "Memproses..." : "Kirim"}
                </button>
              </div>
            </div>

            <div className="mb-3 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {aiMessages.length === 0 ? (
                <p className="text-gray-500">
                  Kirim instruksi untuk mendapatkan saran AI. Saran terakhir bisa diterapkan ke editor.
                </p>
              ) : (
                <ul className="space-y-3">
                  {aiMessages.map((m, i) => (
                    <li
                      key={i}
                      className={
                        m.role === "user"
                          ? "text-gray-800"
                          : "text-green-700"
                      }
                    >
                      <span className="mr-2 rounded bg-gray-100 px-2 py-0.5 text-xs">
                        {m.role}
                      </span>
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAI(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#4699DF] hover:bg-gray-100"
              >
                Tutup
              </button>
              <button
                onClick={applyLastSuggestion}
                disabled={!aiMessages.some((m) => m.role === "assistant")}
                className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                Terapkan ke Editor
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
