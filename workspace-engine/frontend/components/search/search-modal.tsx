"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Search, FileText, CornerDownLeft, Loader2 } from "lucide-react";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  page_id: string;
  title: string;
  icon: string | null;
  snippet: string;
  match_type: string;
  block_id: string | null;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim() || !activeWorkspace) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.searchWorkspace(activeWorkspace.id, query);
        setResults(res.results);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, activeWorkspace]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev === 0 ? results.length - 1 : prev - 1));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelectResult(results[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const handleSelectResult = (item: SearchResult) => {
    onClose();
    router.push(`/${workspaceSlug}/${item.page_id}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm animate-in fade-in duration-100">
      <div
        ref={modalRef}
        className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-slate-100"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages and block contents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
          <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            ESC
          </span>
        </div>

        {/* Search Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() && !loading && results.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No results found for "{query}"
            </div>
          )}

          {!query.trim() && (
            <div className="py-6 text-center text-xs text-slate-400">
              Type keywords to search across titles and block contents
            </div>
          )}

          {results.map((item, index) => {
            const isSelected = index === selectedIndex;

            return (
              <div
                key={`${item.id}-${index}`}
                onClick={() => handleSelectResult(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-start gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-slate-100 dark:bg-slate-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="text-lg select-none mt-0.5">
                  {item.icon || "📄"}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {item.title}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                        item.match_type === "title"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {item.match_type}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {item.snippet}
                  </p>
                </div>

                {isSelected && (
                  <CornerDownLeft className="w-4 h-4 text-slate-400 mt-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>↑↓ to navigate</span>
            <span>·</span>
            <span>↵ to select</span>
          </div>
          <span>WorkspaceEngine Search</span>
        </div>
      </div>
    </div>
  );
}
