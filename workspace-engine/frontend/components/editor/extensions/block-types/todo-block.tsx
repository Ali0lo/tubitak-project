"use client";

import React, { useRef, useEffect } from "react";
import { Block } from "@/types/block";
import { Check } from "lucide-react";

interface TodoBlockProps {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  onChange: (text: string) => void;
  onToggleCheck: (checked: boolean) => void;
  onKeyDown: (e: React.KeyboardEvent, caretOffset: number, text: string) => void;
  onFocus: () => void;
}

export function TodoBlock({
  block,
  isFocused,
  caretOffset,
  onChange,
  onToggleCheck,
  onKeyDown,
  onFocus,
}: TodoBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const text = block.content.map((c) => c.text).join("");
  const isChecked = !!block.properties?.checked;

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
    <div className="flex items-start gap-2.5 py-0.5 group">
      <button
        type="button"
        contentEditable={false}
        onClick={() => onToggleCheck(!isChecked)}
        className={`mt-1 flex items-center justify-center w-4 h-4 rounded border transition-colors ${
          isChecked
            ? "bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900"
            : "border-slate-300 dark:border-slate-600 hover:border-slate-400 bg-white dark:bg-slate-900"
        }`}
      >
        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
      </button>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerText || "")}
        onKeyDown={(e) => onKeyDown(e, 0, ref.current?.innerText || "")}
        onFocus={onFocus}
        data-placeholder="To-do"
        className={`outline-none flex-1 min-h-[1.5em] leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none transition-all ${
          isChecked
            ? "line-through text-slate-400 dark:text-slate-500"
            : "text-slate-800 dark:text-slate-100"
        }`}
      />
    </div>
  );
}
