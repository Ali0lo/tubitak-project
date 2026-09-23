"use client";

import React, { useRef, useEffect, useState } from "react";
import { Block } from "@/types/block";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  onChange: (text: string) => void;
  onLanguageChange: (lang: string) => void;
  onKeyDown: (e: React.KeyboardEvent, caretOffset: number, text: string) => void;
  onFocus: () => void;
}

const LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "html",
  "css",
  "sql",
  "json",
  "bash",
  "markdown",
];

export function CodeBlock({
  block,
  isFocused,
  caretOffset,
  onChange,
  onLanguageChange,
  onKeyDown,
  onFocus,
}: CodeBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const text = block.content.map((c) => c.text).join("");
  const language = block.properties?.language || "typescript";
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 rounded-lg bg-slate-900 text-slate-100 overflow-hidden border border-slate-800 group relative">
      <div
        contentEditable={false}
        className="flex items-center justify-between px-3 py-1.5 bg-slate-950/60 border-b border-slate-800 text-xs text-slate-400 select-none"
      >
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="bg-transparent text-slate-300 hover:text-white outline-none cursor-pointer"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang} className="bg-slate-900 text-slate-200">
              {lang}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerText || "")}
        onKeyDown={(e) => onKeyDown(e, 0, ref.current?.innerText || "")}
        onFocus={onFocus}
        data-placeholder="// Write code here..."
        className="p-4 font-mono text-sm leading-relaxed outline-none min-h-[4em] whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-slate-600 empty:before:pointer-events-none"
      />
    </div>
  );
}
