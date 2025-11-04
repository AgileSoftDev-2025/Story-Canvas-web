import React, { useState, useRef, useEffect } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import {
  Search,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function History() {
  const navigate = useNavigate();
  const [chats, setChats] = useState([
    { id: 1, name: "Marketing Plan", summary: "Discussing Q4 ideas...", date: "24 Jan" },
    { id: 2, name: "Product Roadmap", summary: "Brainstorming session...", date: "23 Jan" },
    { id: 3, name: "Team Check-in", summary: "Weekly progress update...", date: "20 Jan" },
  ]);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  // ✅ Tutup dropdown atau modal rename saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
        setRenameId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Simpan hasil rename
  const handleRenameSave = (id: number) => {
    if (!renameValue.trim()) return;
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id ? { ...chat, name: renameValue.trim() } : chat
      )
    );
    setRenameId(null);
    setOpenMenuId(null);
  };

  // ✅ Delete chat dari list
  const handleDelete = (id: number) => {
    setChats((prev) => prev.filter((chat) => chat.id !== id));
    setOpenMenuId(null);
  };

  // ✅ Klik chat → ke halaman detail
  const handleOpenChat = (id: number) => {
    navigate(`/HistoryDetail`);
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-white text-gray-800">
      <Header />

      <main className="flex-grow px-8 md:px-24 lg:px-36 py-16 animate-fade-in-up">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-8 text-black">
          SEARCH YOUR CHAT
        </h1>

        {/* 🔹 Search Bar */}
        <div className="relative max-w-3xl mx-auto mb-12">
          <div className="p-[2px] rounded-full bg-gradient-to-r from-[#5F3D89] via-[#5561AA] to-[#4699DF]">
            <div className="flex items-center bg-white rounded-full overflow-hidden">
              <input
                type="text"
                placeholder="Enter a search term"
                className="flex-grow py-4 pl-6 pr-16 rounded-full bg-white text-gray-800 text-lg placeholder-gray-400 focus:outline-none"
              />
              <button className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-[#5F3D89] to-[#4699DF] hover:opacity-90 p-3 rounded-full transition">
                <Search className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-400 mb-10">
          Search by name or summary
        </p>

        {/* 🔹 Chat List */}
        <div className="space-y-6 max-w-4xl mx-auto">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className="relative flex items-start justify-between border-b border-gray-200 pb-4 hover:bg-gradient-to-r from-[#f8f9ff] to-[#eef3ff] transition duration-200 px-2 rounded-md"
            >
              {/* Klik kiri buka halaman detail */}
              <div
                onClick={() => handleOpenChat(chat.id)}
                className="flex items-start space-x-4 cursor-pointer flex-grow"
              >
                <div className="p-2 bg-gray-100 rounded-md">
                  <MessageSquare className="w-7 h-7 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 hover:text-[#4699DF] transition">
                    {chat.name}
                  </h3>
                  <p className="text-gray-500 text-sm">{chat.summary}</p>
                </div>
              </div>

              {/* Menu Dropdown */}
              <div className="relative flex flex-col items-end" ref={menuRef}>
                <span className="text-gray-500 text-sm whitespace-nowrap mb-1">
                  {chat.date}
                </span>
                <button
                  onClick={() =>
                    setOpenMenuId(openMenuId === chat.id ? null : chat.id)
                  }
                  className="p-1 hover:bg-gray-100 rounded-full transition"
                >
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>

                {/* Dropdown */}
                {openMenuId === chat.id && (
                  <div className="absolute right-0 top-8 w-40 bg-white shadow-md rounded-lg border border-gray-100 py-2 z-10 animate-fade-in-up">
                    <button
                      onClick={() => {
                        setRenameId(chat.id);
                        setRenameValue(chat.name);
                      }}
                      className="w-full flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                    >
                      <Pencil className="w-4 h-4 mr-2 text-gray-500" />
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(chat.id)}
                      className="w-full flex items-center px-4 py-2 text-red-600 hover:bg-gray-100 transition"
                    >
                      <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                      Delete
                    </button>
                  </div>
                )}

                {/* Inline Rename */}
                {renameId === chat.id && (
                  <div className="absolute right-0 top-14 w-60 bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex items-center space-x-2 z-20 animate-fade-in-up">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-grow border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#4699DF]"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameSave(chat.id)}
                      className="p-1 bg-green-500 hover:bg-green-600 text-white rounded-md transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRenameId(null)}
                      className="p-1 bg-gray-300 hover:bg-gray-400 text-white rounded-md transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {chats.length === 0 && (
            <p className="text-center text-gray-500 mt-10">
              No chats available.
            </p>
          )}
        </div>

        {/* Pagination */}
        <div className="flex justify-between max-w-4xl mx-auto mt-10 text-sm text-gray-500">
          <span>1 - {chats.length} of {chats.length}</span>
          <button className="text-[#4699DF] font-medium hover:underline">
            Load more
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
