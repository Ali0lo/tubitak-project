"use client";

import React, { useState } from "react";
import { Block } from "@/types/block";
import { Image as ImageIcon, Link as LinkIcon } from "lucide-react";

interface ImageBlockProps {
  block: Block;
  onChangeUrl: (url: string) => void;
  onFocus: () => void;
}

export function ImageBlock({ block, onChangeUrl, onFocus }: ImageBlockProps) {
  const url = block.properties?.url || "";
  const [inputUrl, setInputUrl] = useState("");
  const [isEditing, setIsEditing] = useState(!url);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      onChangeUrl(inputUrl.trim());
      setIsEditing(false);
    }
  };

  if (isEditing || !url) {
    return (
      <div
        onClick={onFocus}
        className="my-3 p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 text-center"
      >
        <div className="flex justify-center mb-2 text-slate-400">
          <ImageIcon className="w-8 h-8 stroke-[1.5]" />
        </div>
        <form onSubmit={handleSubmit} className="flex max-w-md mx-auto gap-2">
          <input
            type="url"
            placeholder="Paste an image link..."
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none focus:border-slate-500 text-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-sm font-medium rounded transition-colors"
          >
            Embed
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="my-3 group relative rounded-lg overflow-hidden" onClick={onFocus}>
      <img
        src={url}
        alt="User uploaded content"
        className="max-h-[500px] w-auto max-w-full rounded-lg mx-auto object-cover"
      />
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/70 p-1.5 rounded-md flex gap-2 text-white">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs hover:underline flex items-center gap-1"
        >
          <LinkIcon className="w-3 h-3" />
          <span>Change URL</span>
        </button>
      </div>
    </div>
  );
}
