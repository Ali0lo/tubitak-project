"use client";

import React from "react";
import { Block } from "@/types/block";

interface DividerBlockProps {
  block: Block;
  onFocus?: () => void;
}

export function DividerBlock({ onFocus }: DividerBlockProps) {
  return (
    <div
      onClick={onFocus}
      className="py-3 cursor-pointer group"
    >
      <hr className="border-t border-slate-200 dark:border-slate-800 transition-colors group-hover:border-slate-400" />
    </div>
  );
}
