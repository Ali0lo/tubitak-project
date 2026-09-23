"use client";

import React, { useRef, useEffect } from "react";
import { Block } from "@/types/block";

interface QuoteBlockProps {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent, caretOffset: number, text: string) => void;
  onFocus: () => void;
}

export function QuoteBlock({
  block,
  isFocused,
  caretOffset,
  onChange,
  onKeyDown,
  onFocus,
}: QuoteBlockProps) {
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
    <div className="border-l-3 border-slate-900 dark:border-slate-100 pl-4 py-1 my-1 italic text-slate-700 dark:text-slate-300">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerText || "")}
        onKeyDown={(e) => onKeyDown(e, 0, ref.current?.innerText || "")}
        onFocus={onFocus}
        data-placeholder="Empty quote"
        className="outline-none min-h-[1.5em] leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
      />
    </div>
  );
}
