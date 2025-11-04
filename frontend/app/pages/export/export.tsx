import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { Download, FileText, Image as ImageIcon, CheckSquare, Square } from "lucide-react";

export default function ExportPage() {
  const [exportItems, setExportItems] = useState([
    { id: 1, name: "User Story", type: "text", selected: false },
    { id: 2, name: "Wireframe", type: "image", selected: false },
    { id: 3, name: "User Story Scenario", type: "text", selected: false },
  ]);

  const toggleSelect = (id: number) => {
    setExportItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const selectAll = () => {
    const allSelected = exportItems.every((item) => item.selected);
    setExportItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const downloadImage = (filename: string, imagePath: string) => {
    const link = document.createElement("a");
    link.href = imagePath;
    link.download = filename;
    link.click();
  };

  const handleExport = () => {
    const selectedItems = exportItems.filter((i) => i.selected);

    if (selectedItems.length === 0) {
      alert("Pilih minimal satu bagian untuk diexport!");
      return;
    }

    selectedItems.forEach((item) => {
      if (item.type === "text") {
        if (item.name === "User Story") {
          downloadText("user_story.txt", "Contoh User Story:\nSebagai pengguna, saya ingin ...");
        } else if (item.name === "User Story Scenario") {
          downloadText("user_story_scenario.txt", "Scenario 1:\nGiven ... When ... Then ...");
        }
      } else if (item.type === "image") {
        downloadImage("wireframe.png", "/assets/generated1.png"); // ganti sesuai path wireframe kamu
      }
    });

    alert("Export berhasil! File telah diunduh.");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 container mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-4xl font-bold mb-6">Export Your Project</h1>
        <p className="text-gray-600 mb-8">
          Pilih bagian yang ingin kamu unduh — bisa satu per satu, atau semuanya sekaligus.
        </p>

        {/* Export Options */}
        <div className="space-y-4">
          {exportItems.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleSelect(item.id)}
              className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition ${
                item.selected
                  ? "border-[#4699DF] bg-blue-50 dark:bg-gray-800"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-center gap-3">
                {item.selected ? (
                  <CheckSquare className="w-5 h-5 text-[#4699DF]" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                )}
                <h3 className="text-lg font-medium">{item.name}</h3>
              </div>

              {item.type === "text" ? (
                <FileText className="w-5 h-5 text-gray-500" />
              ) : (
                <ImageIcon className="w-5 h-5 text-gray-500" />
              )}
            </div>
          ))}
        </div>

        {/* Select All & Export Buttons */}
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={selectAll}
            className="px-6 py-2 rounded-lg border border-gray-300 bg-white font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
          >
            Select All / Unselect All
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 text-white font-medium shadow-sm transition hover:opacity-95"
          >
            <Download className="w-5 h-5" /> Export Selected
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-10"></div>

        {/* Export Preview (Optional) */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Preview (Optional)</h2>
          <p className="text-gray-600 mb-2">
            Kamu bisa melihat pratinjau hasil generate sebelum download:
          </p>

          <div className="space-y-6 mt-4">
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <h3 className="font-semibold mb-2">User Story</h3>
              <p className="text-gray-700 dark:text-gray-200">
                Sebagai pengguna, saya ingin mengelola akun saya agar bisa login dan logout dengan mudah.
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <h3 className="font-semibold mb-2">Wireframe</h3>
              <img
                src="/assets/generated1.png"
                alt="Wireframe"
                className="rounded-md border border-gray-300 dark:border-gray-700"
              />
            </div>

            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <h3 className="font-semibold mb-2">User Story Scenario</h3>
              <pre className="text-gray-700 dark:text-gray-200 text-sm whitespace-pre-wrap">
{`Scenario 1: Successful Login
Given the user is on the login page
When the user enters valid credentials
Then the system should display the dashboard`}
              </pre>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
