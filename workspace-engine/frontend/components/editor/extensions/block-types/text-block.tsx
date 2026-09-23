"use client";

import React, { useRef, useEffect } from "react";
import { Block } from "@/types/block";

interface TextBlockProps {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent, caretOffset: number, text: string) => void;
  onFocus: () => void;
}

export function TextBlock({
  block,
  isFocused,
  caretOffset,
  onChange,
  onKeyDown,
  onFocus,
}: TextBlockProps) {
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
      if (caretOffset !== null) {
        setCaretPosition(ref.current, caretOffset);
      }
    }
  }, [isFocused, caretOffset]);

  const handleInput = () => {
    if (ref.current) {
      onChange(ref.current.innerText);
    }
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent) => {
    const offset = getCaretPosition(ref.current);
    onKeyDown(e, offset, ref.current?.innerText || "");
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDownInternal}
      onFocus={onFocus}
      data-placeholder="Type '/' for commands..."
      className="outline-none min-h-[1.5em] py-0.5 text-slate-800 dark:text-slate-100 font-normal leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
    />
  );
}

function getCaretPosition(element: HTMLElement | null): number {
  if (!element) return 0;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

function setCaretPosition(element: HTMLElement, offset: number) {
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;

  let currentOffset = 0;
  let node: Node | null = element.firstChild;

  if (!node) {
    range.setStart(element, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (currentOffset + len >= offset) {
        range.setStart(node, Math.min(offset - currentOffset, len));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      currentOffset += len;
    }
    node = node.nextSibling;
  }

  range.selectNodeContents(element);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
