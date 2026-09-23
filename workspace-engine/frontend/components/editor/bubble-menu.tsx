"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Palette,
} from "lucide-react";

interface BubbleMenuProps {
  onFormat: (format: "bold" | "italic" | "strike" | "code" | "link" | "color", value?: string) => void;
}

export function BubbleMenu({ onFormat }: BubbleMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setVisible(false);
        setShowColorPicker(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width > 0) {
        setPosition({
          top: Math.max(10, rect.top - 46),
          left: Math.max(10, rect.left + rect.width / 2 - 130),
        });
        setVisible(true);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  if (!visible) return null;

  const COLORS = [
    { label: "Default", color: "inherit" },
    { label: "Gray", color: "#64748b" },
    { label: "Brown", color: "#92400e" },
    { label: "Orange", color: "#ea580c" },
    { label: "Yellow", color: "#ca8a04" },
    { label: "Green", color: "#16a34a" },
    { label: "Blue", color: "#2563eb" },
    { label: "Purple", color: "#9333ea" },
    { label: "Pink", color: "#db2777" },
    { label: "Red", color: "#dc2626" },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="fixed z-50 flex items-center gap-0.5 p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900 text-white shadow-xl text-xs animate-in fade-in zoom-in-95 duration-75"
    >
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormat("bold");
        }}
        className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
        title="Bold (Cmd+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormat("italic");
        }}
        className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
        title="Italic (Cmd+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormat("strike");
        }}
        className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormat("code");
        }}
        className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
        title="Inline Code"
      >
        <Code className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-slate-700 mx-1" />

      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          const url = prompt("Enter hyperlink URL:");
          if (url) onFormat("link", url);
        }}
        className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
        title="Insert Link"
      >
        <LinkIcon className="w-3.5 h-3.5" />
      </button>

      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowColorPicker(!showColorPicker);
          }}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
          title="Color"
        >
          <Palette className="w-3.5 h-3.5" />
        </button>

        {showColorPicker && (
          <div className="absolute top-8 left-0 p-2 rounded-lg bg-slate-900 border border-slate-800 shadow-xl grid grid-cols-5 gap-1.5 z-50">
            {COLORS.map((c) => (
              <button
                key={c.color}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onFormat("color", c.color);
                  setShowColorPicker(false);
                }}
                className="w-4 h-4 rounded-full border border-slate-700 hover:scale-110 transition-transform"
                style={{ backgroundColor: c.color }}
                title={c.label}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
