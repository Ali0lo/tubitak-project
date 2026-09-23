"use client";

import React, { useRef, useEffect } from "react";
import { Block } from "@/types/block";

interface CalloutBlockProps {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  onChange: (text: string) => void;
  onIconChange: (icon: string) => void;
  onKeyDown: (e: React.KeyboardEvent, caretOffset: number, text: string) => void;
  onFocus: () => void;
}

const DEFAULT_ICONS = ["💡", "⚠️", "📌", "✨", "🔥", "ℹ️", "🚀"];

export function CalloutBlock({
  block,
  isFocused,
  caretOffset,
  onChange,
  onIconChange,
  onKeyDown,
  onFocus,
}: CalloutBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const text = block.content.map((c) => c.text).join("");
  const icon = block.properties?.calloutIcon || "💡";

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

  const handleNextIcon = () => {
    const currIdx = DEFAULT_ICONS.indexOf(icon);
    const nextIdx = (currIdx + 1) % DEFAULT_ICONS.length;
    onIconChange(DEFAULT_ICONS[nextIdx]);
  };

  return (
    <div className="flex items-start gap-3 p-3.5 my-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/80">
      <button
        type="button"
        contentEditable={false}
        onClick={handleNextIcon}
        title="Click to cycle icon"
        className="select-none text-xl p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
      >
        {icon}
      </button>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerText || "")}
        onKeyDown={(e) => onKeyDown(e, 0, ref.current?.innerText || "")}
        onFocus={onFocus}
        data-placeholder="Callout note..."
        className="outline-none flex-1 min-h-[1.5em] leading-relaxed text-slate-800 dark:text-slate-100 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
      />
    </div>
  );
}
