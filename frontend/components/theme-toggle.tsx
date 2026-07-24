"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useState, useRef, useEffect } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-seal hover:bg-forest-tint text-ink transition-colors focus-ring flex items-center justify-center"
        aria-label="Toggle theme"
        title={`Current theme: ${theme} (${resolvedTheme})`}
      >
        {resolvedTheme === "dark" ? (
          <Moon className="h-5 w-5 text-amber-400" />
        ) : (
          <Sun className="h-5 w-5 text-amber-600" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl bg-paper border border-paper-line shadow-xl z-50 p-1 animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={() => {
              setTheme("light");
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
              theme === "light" ? "bg-forest-tint text-forest font-semibold" : "text-ink hover:bg-paper-raised"
            }`}
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
              theme === "dark" ? "bg-forest-tint text-forest font-semibold" : "text-ink hover:bg-paper-raised"
            }`}
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
          <button
            type="button"
            onClick={() => {
              setTheme("system");
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
              theme === "system" ? "bg-forest-tint text-forest font-semibold" : "text-ink hover:bg-paper-raised"
            }`}
          >
            <Monitor className="h-4 w-4" />
            System
          </button>
        </div>
      )}
    </div>
  );
}
