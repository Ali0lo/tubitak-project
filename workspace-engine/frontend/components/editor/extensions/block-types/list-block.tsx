"use client";

import React, { useRef, useEffect } from "react";
import { Block } from "@/types/block";

interface ListBlockProps {
  block: Block;
  listType: "bulleted_list" | "numbered_list";
  indexNumber?: number;
  isFocused: boolean;
  caretOffset: number | null;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent, caretOffset: number, text: string) => void;
  onFocus: () => void;
}

export function ListBlock({
  block,
  listType,
  indexNumber = 1,
  isFocused,
  caretOffset,
  onChange,
  onKeyDown,
  onFocus,
}: ListBlockProps) {
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
    <div className="flex items-start gap-2.5 py-0.5">
      <div
        contentEditable={false}
        className="select-none text-slate-500 dark:text-slate-400 font-medium text-sm flex items-center justify-center min-w-[1.25rem] mt-0.5"
      >
        {listType === "bulleted_list" ? (
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700 dark:bg-slate-300 inline-block" />
        ) : (
          <span>{indexNumber}.</span>
        )}
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerText || "")}
        onKeyDown={(e) => onKeyDown(e, 0, ref.current?.innerText || "")}
        onFocus={onFocus}
        data-placeholder="List item"
        className="outline-none flex-1 min-h-[1.5em] leading-relaxed text-slate-800 dark:text-slate-100 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
      />
    </div>
  );
}
