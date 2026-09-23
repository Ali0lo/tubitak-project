"use client";

import React, { useState, useRef, useEffect } from "react";
import { Smile, X } from "lucide-react";

interface PageIconPickerProps {
  currentIcon: string | null;
  onSelectIcon: (icon: string | null) => void;
}

const EMOJI_PALETTE = [
  "📄", "📝", "🚀", "💡", "🪐", "✨", "🎯", "📌", "🔥", "⚡",
  "💻", "🛠️", "📚", "🎨", "🔬", "📊", "📈", "🌐", "🔒", "🔑",
  "⭐", "❤️", "☕", "🍕", "🌱", "🌲", "🏠", "🏢", "🚗", "✈️",
];

export function PageIconPicker({ currentIcon, onSelectIcon }: PageIconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center text-4xl hover:scale-105 transition-transform p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        title="Change icon"
      >
        {currentIcon || "📄"}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-2 z-50 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Select Icon
            </span>
            {currentIcon && (
              <button
                type="button"
                onClick={() => {
                  onSelectIcon(null);
                  setIsOpen(false);
                }}
                className="text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Remove</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
            {EMOJI_PALETTE.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelectIcon(emoji);
                  setIsOpen(false);
                }}
                className="w-8 h-8 flex items-center justify-center text-lg rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
