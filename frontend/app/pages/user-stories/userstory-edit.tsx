import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { loadStory, saveStory, type StorySections, requestAISuggestion } from "./userstory-data";

type SectionKey = keyof StorySections;

export default function UserStoryEditPage() {
  const navigate = useNavigate();
  const initial = useMemo(() => loadStory(), []);
  const [form, setForm] = useState<StorySections>(initial);
  const [showAI, setShowAI] = useState(false);
  const [aiTarget, setAiTarget] = useState<SectionKey>("individual");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const onSave = () => {
    saveStory(form);
    navigate("/UserStoryPage");
  };

  const onCancel = () => {
    navigate("/UserStoryPage");
  };

  const onChange = (key: SectionKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const sendToAI = async () => {
    if (!aiInput.trim()) return;
    const current = form[aiTarget];
    const msg = aiInput.trim();
    setAiMessages((m) => [...m, { role: "user", content: msg }]);
    setAiBusy(true);
    try {
      const suggestion = await requestAISuggestion(msg, current);
      setAiMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: suggestion,
        },
      ]);
      setAiInput("");
    } finally {
      setAiBusy(false);
    }
  };

  const applyLastSuggestion = () => {
    const last = [...aiMessages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    onChange(aiTarget, last.content);
    setShowAI(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="container mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold md:text-4xl">Edit User Story</h1>
          <button
            onClick={() => setShowAI(true)}
            className="rounded-lg bg-gradient-to-r from-[#5F3D89] to-[#4699DF] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
          >
            Butuh bantuan AI?
          </button>
        </div>

        <p className="mb-6 text-sm text-gray-500">Gunakan format bernomor. Setiap baris adalah 1 user story.</p>

        <EditSection
          title="Individual Users"
          value={form.individual}
          onChange={(v) => onChange("individual", v)}
        />

        <EditSection
          title="Financial Advisors"
          value={form.advisors}
          onChange={(v) => onChange("advisors", v)}
        />

        <EditSection
          title="Investment Managers"
          value={form.managers}
          onChange={(v) => onChange("managers", v)}
        />

        <EditSection
          title="Administrators"
          value={form.admins}
          onChange={(v) => onChange("admins", v)}
        />

        <div className="mt-6 flex items-center justify-end gap-4 pb-6">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-[#4699DF] shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-6 py-2 font-medium text-white shadow-sm transition hover:opacity-95"
          >
            Save
          </button>
        </div>
      </main>

      <Footer />

      {showAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Butuh bantuan AI?</h3>
              <button onClick={() => setShowAI(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium">Target Section</label>
                <select
                  value={aiTarget}
                  onChange={(e) => setAiTarget(e.target.value as SectionKey)}
                  className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="individual">Individual Users</option>
                  <option value="advisors">Financial Advisors</option>
                  <option value="managers">Investment Managers</option>
                  <option value="admins">Administrators</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Instruksi</label>
                <div className="flex gap-2">
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Contoh: perbaiki grammar dan ringkas kalimat."
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
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
            </div>

            <div className="mb-3 max-h-64 overflow-auto rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
              {aiMessages.length === 0 ? (
                <p className="text-gray-500">Kirim instruksi untuk mendapatkan saran AI. Saran terakhir bisa diterapkan ke editor.</p>
              ) : (
                <ul className="space-y-3">
                  {aiMessages.map((m, i) => (
                    <li key={i} className={m.role === "user" ? "text-gray-800" : "text-green-700 dark:text-green-400"}>
                      <span className="mr-2 rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{m.role}</span>
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAI(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#4699DF] dark:border-gray-700 dark:bg-gray-900"
              >
                Tutup
              </button>
              <button
                onClick={applyLastSuggestion}
                disabled={!aiMessages.some((m) => m.role === "assistant")}
                className="rounded-lg bg-gradient-to-r from-[#5561AA] to-[#4699DF] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Terapkan ke Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditSection({ title, value, onChange }: { title: string; value: string; onChange: (v: string) => void }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold underline">{title}</h2>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="w-full whitespace-pre-wrap rounded-2xl border border-gray-300 bg-white p-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-gray-700 dark:bg-gray-900"
      />
      <p className="mt-2 text-xs text-gray-500">Tip: satu baris = satu user story. Nomori seperti 1., 2., 3.</p>
    </section>
  );
}
