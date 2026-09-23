"use client";

import React, { useState } from "react";
import { Block } from "@/types/block";
import { Globe, Link as LinkIcon, ExternalLink } from "lucide-react";

interface EmbedBlockProps {
  block: Block;
  onChangeUrl: (url: string) => void;
  onChangeCaption?: (caption: string) => void;
  onFocus: () => void;
}

/**
 * Normalizes common video and interactive embed URLs into secure iframe source URLs.
 */
function getEmbedSource(url: string): { embedUrl: string; type: "youtube" | "vimeo" | "figma" | "generic" } {
  const trimmed = url.trim();

  // YouTube match: watch?v=, youtu.be/, shorts/, embed/
  const ytMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  if (ytMatch && ytMatch[1]) {
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
      type: "youtube",
    };
  }

  // Vimeo match: vimeo.com/123456789
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      type: "vimeo",
    };
  }

  // Figma match
  if (trimmed.includes("figma.com/")) {
    return {
      embedUrl: `https://www.figma.com/embed?embed_host=workspace-engine&url=${encodeURIComponent(trimmed)}`,
      type: "figma",
    };
  }

  return {
    embedUrl: trimmed,
    type: "generic",
  };
}

export function EmbedBlock({
  block,
  onChangeUrl,
  onChangeCaption,
  onFocus,
}: EmbedBlockProps) {
  const url = block.properties?.url || "";
  const caption = block.properties?.caption || "";
  const [inputUrl, setInputUrl] = useState("");
  const [isEditing, setIsEditing] = useState(!url);
  const [captionInput, setCaptionInput] = useState(caption);
  const [isEditingCaption, setIsEditingCaption] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = inputUrl.trim();
    if (cleanUrl) {
      onChangeUrl(cleanUrl);
      setIsEditing(false);
    }
  };

  const handleSaveCaption = () => {
    if (onChangeCaption) {
      onChangeCaption(captionInput);
    }
    setIsEditingCaption(false);
  };

  if (isEditing || !url) {
    return (
      <div
        onClick={onFocus}
        className="my-3 p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 text-center"
      >
        <div className="flex justify-center mb-2 text-slate-400">
          <Globe className="w-8 h-8 stroke-[1.5]" />
        </div>
        <form onSubmit={handleSubmit} className="flex max-w-md mx-auto gap-2">
          <input
            type="url"
            placeholder="Paste link (YouTube, Vimeo, Figma, or generic web URL)..."
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none focus:border-slate-500 text-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-sm font-medium rounded transition-colors"
          >
            Embed link
          </button>
          {url && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    );
  }

  const { embedUrl, type } = getEmbedSource(url);
  const containerHeightClass = type === "figma" ? "h-[450px]" : "aspect-video";

  return (
    <div className="my-3 group relative rounded-lg" onClick={onFocus}>
      <div className={`relative w-full ${containerHeightClass} rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950`}>
        <iframe
          src={embedUrl}
          title={`Embedded content from ${url}`}
          className="w-full h-full border-0 rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
        />

        {/* Hover Action Overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-md flex items-center gap-3 text-white text-xs shadow-md">
          <button
            type="button"
            onClick={() => {
              setInputUrl(url);
              setIsEditing(true);
            }}
            className="hover:underline flex items-center gap-1"
          >
            <LinkIcon className="w-3 h-3" />
            <span>Change URL</span>
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open</span>
          </a>
        </div>
      </div>

      {/* Caption */}
      <div className="mt-1.5 text-center">
        {isEditingCaption ? (
          <input
            type="text"
            value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
            onBlur={handleSaveCaption}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveCaption();
            }}
            placeholder="Write a caption..."
            autoFocus
            className="w-full max-w-sm text-center text-xs text-slate-500 dark:text-slate-400 bg-transparent border-b border-slate-300 dark:border-slate-700 outline-none pb-0.5"
          />
        ) : (
          <p
            onClick={() => setIsEditingCaption(true)}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer inline-block"
          >
            {caption || "Add a caption..."}
          </p>
        )}
      </div>
    </div>
  );
}
