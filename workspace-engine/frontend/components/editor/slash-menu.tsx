"use client";

import React, { useEffect, useState, useRef } from "react";
import { BlockType } from "@/types/block";
import { BLOCK_DEFINITIONS, BlockDefinition } from "./block-registry";

interface SlashMenuProps {
  isOpen: boolean;
  filter: string;
  position: { top: number; left: number } | null;
  onSelectType: (type: BlockType) => void;
  onClose: () => void;
}

export function SlashMenu({
  isOpen,
  filter,
  position,
  onSelectType,
  onClose,
}: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredItems = BLOCK_DEFINITIONS.filter((item) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? filteredItems.length - 1 : prev - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelectType(filteredItems[selectedIndex].type);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, onSelectType, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Basic blocks
      </div>

      {filteredItems.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-slate-400">
          No matching blocks
        </div>
      ) : (
        filteredItems.map((item, index) => {
          const Icon = item.icon;
          const isSelected = index === selectedIndex;

          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onSelectType(item.type)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`flex items-center gap-3 w-full px-2.5 py-1.5 rounded-md text-left transition-colors ${
                isSelected
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center justify-center w-7 h-7 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-medium leading-none">{item.label}</div>
                <div className="text-xs text-slate-400 truncate mt-0.5">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
