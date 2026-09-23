"use client";

import React, { useRef, useEffect } from "react";
import { Block } from "@/types/block";
import { ChevronRight } from "lucide-react";

interface ToggleBlockProps {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent, caretOffset: number, text: string) => void;
  onFocus: () => void;
  children?: React.ReactNode;
}

export function ToggleBlock({
  block,
  isFocused,
  caretOffset,
  isOpen,
  onToggleOpen,
  onChange,
  onKeyDown,
  onFocus,
  children,
}: ToggleBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const text = block.content.map((c) => c.text).join("");

  useEffect(() => {
    if (ref.current && ref.current.innerText !== text) {
      ref.current.innerText = text;
    }
  }, [text]);

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
    }
  }, [isFocused, caretOffset]);

  return (
    <div className="py-0.5">
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          contentEditable={false}
          onClick={onToggleOpen}
          className="mt-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-transform"
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-150 ${
              isOpen ? "rotate-90" : ""
            }`}
          />
        </button>

        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(ref.current?.innerText || "")}
          onKeyDown={(e) => onKeyDown(e, 0, ref.current?.innerText || "")}
          onFocus={onFocus}
          data-placeholder="Toggle"
          className="outline-none flex-1 min-h-[1.5em] leading-relaxed text-slate-800 dark:text-slate-100 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
        />
      </div>

      {isOpen && (
        <div className="ml-6 pl-2 border-l border-slate-200 dark:border-slate-800 mt-1">
          {children}
        </div>
      )}
    </div>
  );
}
