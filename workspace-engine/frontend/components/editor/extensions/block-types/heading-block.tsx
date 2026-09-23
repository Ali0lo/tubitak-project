"use client";

import React, { useRef, useEffect } from "react";
import { Block } from "@/types/block";

interface HeadingBlockProps {
  block: Block;
  level: 1 | 2 | 3;
  isFocused: boolean;
  caretOffset: number | null;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent, caretOffset: number, text: string) => void;
  onFocus: () => void;
}

export function HeadingBlock({
  block,
  level,
  isFocused,
  caretOffset,
  onChange,
  onKeyDown,
  onFocus,
}: HeadingBlockProps) {
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

  const handleInput = () => {
    if (ref.current) {
      onChange(ref.current.innerText);
    }
  };

  const getHeadingStyle = () => {
    switch (level) {
      case 1:
        return "text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-6 mb-2";
      case 2:
        return "text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mt-4 mb-1";
      case 3:
        return "text-xl font-semibold text-slate-800 dark:text-slate-100 mt-3 mb-1";
    }
  };

  const placeholder = `Heading ${level}`;

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={(e) => onKeyDown(e, 0, ref.current?.innerText || "")}
      onFocus={onFocus}
      data-placeholder={placeholder}
      className={`outline-none min-h-[1.4em] py-0.5 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-600 empty:before:pointer-events-none ${getHeadingStyle()}`}
    />
  );
}
