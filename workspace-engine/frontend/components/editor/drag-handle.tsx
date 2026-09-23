"use client";

import React, { useState, useRef, useEffect } from "react";
import { GripVertical, Trash2, Copy, Repeat, Plus } from "lucide-react";
import { Block, BlockType } from "@/types/block";
import { BLOCK_DEFINITIONS } from "./block-registry";

interface DragHandleProps {
  block: Block;
  onAddBlockBelow: () => void;
  onDeleteBlock: () => void;
  onDuplicateBlock: () => void;
  onTurnInto: (type: BlockType) => void;
  onDragStart: (e: React.DragEvent) => void;
}

export function DragHandle({
  block,
  onAddBlockBelow,
  onDeleteBlock,
  onDuplicateBlock,
  onTurnInto,
  onDragStart,
}: DragHandleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [turnIntoSubmenu, setTurnIntoSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setTurnIntoSubmenu(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="relative flex items-center gap-0.5 select-none opacity-0 group-hover/block:opacity-100 transition-opacity">
      {/* Quick Add Button (+) */}
      <button
        type="button"
        contentEditable={false}
        onClick={onAddBlockBelow}
        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        title="Click to add a block below"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* Draggable Handle (:::) */}
      <button
        type="button"
        contentEditable={false}
        draggable
        onDragStart={onDragStart}
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        title="Drag to move or click to open menu"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Action Menu Popover */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute left-full top-0 ml-1 z-50 w-52 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1 text-slate-800 dark:text-slate-100 text-xs animate-in fade-in zoom-in-95 duration-75"
        >
          <button
            type="button"
            onClick={() => {
              onDeleteBlock();
              setMenuOpen(false);
            }}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDuplicateBlock();
              setMenuOpen(false);
            }}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setTurnIntoSubmenu(!turnIntoSubmenu)}
              className="flex items-center justify-between w-full px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-2.5">
                <Repeat className="w-3.5 h-3.5" />
                <span>Turn into</span>
              </div>
              <span className="text-[10px] text-slate-400">▶</span>
            </button>

            {turnIntoSubmenu && (
              <div className="absolute left-full top-0 ml-1 w-44 max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1 z-50">
                {BLOCK_DEFINITIONS.map((def) => {
                  const Icon = def.icon;
                  return (
                    <button
                      key={def.type}
                      type="button"
                      onClick={() => {
                        onTurnInto(def.type);
                        setMenuOpen(false);
                        setTurnIntoSubmenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                    >
                      <Icon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{def.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
