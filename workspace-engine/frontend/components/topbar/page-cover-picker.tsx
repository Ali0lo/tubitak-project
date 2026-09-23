"use client";

import React, { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, X } from "lucide-react";

interface PageCoverPickerProps {
  currentCover: string | null;
  onSelectCover: (cover: string | null) => void;
}

const COVER_PRESETS = [
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&auto=format&fit=crop&q=80",
];

export function PageCoverPicker({ currentCover, onSelectCover }: PageCoverPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onSelectCover(customUrl.trim());
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        <span>{currentCover ? "Change cover" : "Add cover"}</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cover Image
            </span>
            {currentCover && (
              <button
                type="button"
                onClick={() => {
                  onSelectCover(null);
                  setIsOpen(false);
                }}
                className="text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Remove</span>
              </button>
            )}
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {COVER_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectCover(preset);
                  setIsOpen(false);
                }}
                className="h-14 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-85 transition-opacity"
              >
                <img
                  src={preset}
                  alt={`Cover preset ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>

          {/* Custom Link Form */}
          <form onSubmit={handleCustomSubmit} className="flex gap-1.5">
            <input
              type="url"
              placeholder="Paste image URL..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="flex-1 px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-slate-400 text-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium rounded hover:opacity-90 transition-opacity"
            >
              Set
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
