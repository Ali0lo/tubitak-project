"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Page } from "@/types/page";
import { Block } from "@/types/block";
import { apiClient } from "@/lib/api-client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useEditorStore } from "@/stores/editor-store";
import { BlockEditor } from "@/components/editor/block-editor";
import { PageIconPicker } from "@/components/topbar/page-icon-picker";
import { PageCoverPicker } from "@/components/topbar/page-cover-picker";
import { Loader2 } from "lucide-react";

export default function DocumentPage() {
  const params = useParams();
  const pageId = params?.pageId as string;

  const [page, setPage] = useState<Page | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  const { updatePageInTree, setActivePageId } = useWorkspaceStore();
  const { setActivePage } = useEditorStore();
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setActivePageId(pageId);
    let isMounted = true;

    async function loadPage() {
      // 1. Optimistic offline-first local cache load
      if (typeof window !== "undefined") {
        try {
          const cachedPage = localStorage.getItem(`offline_page_${pageId}`);
          const cachedBlocks = localStorage.getItem(`offline_blocks_${pageId}`);
          if (cachedPage && isMounted) {
            const parsedPage = JSON.parse(cachedPage);
            setPage(parsedPage);
            setActivePage(parsedPage);
          }
          if (cachedBlocks && isMounted) {
            setBlocks(JSON.parse(cachedBlocks));
          }
        } catch {
          // Ignore cache parse errors
        }
      }

      setLoading(true);
      try {
        const [pageData, blockData] = await Promise.all([
          apiClient.getPage(pageId),
          apiClient.getPageBlocks(pageId),
        ]);

        if (isMounted) {
          setPage(pageData);
          setBlocks(blockData);
          setActivePage(pageData);

          // Save to local cache
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`offline_page_${pageId}`, JSON.stringify(pageData));
              localStorage.setItem(`offline_blocks_${pageId}`, JSON.stringify(blockData));
            } catch {
              // Ignore storage quota errors
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load page from API, using offline local state:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPage();
    return () => {
      isMounted = false;
    };
  }, [pageId, setActivePageId, setActivePage]);

  const handleTitleChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!page) return;
    const newTitle = e.target.value;
    setPage({ ...page, title: newTitle });
    updatePageInTree(page.id, { title: newTitle });

    try {
      await apiClient.updatePage(page.id, { title: newTitle });
    } catch (err) {
      console.error("Failed to update page title:", err);
    }
  };

  const handleIconChange = async (newIcon: string | null) => {
    if (!page) return;
    setPage({ ...page, icon: newIcon });
    updatePageInTree(page.id, { icon: newIcon });

    try {
      await apiClient.updatePage(page.id, { icon: newIcon });
    } catch (err) {
      console.error("Failed to update icon:", err);
    }
  };

  const handleCoverChange = async (newCover: string | null) => {
    if (!page) return;
    setPage({ ...page, cover_image: newCover });

    try {
      await apiClient.updatePage(page.id, { cover_image: newCover });
    } catch (err) {
      console.error("Failed to update cover:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 text-xs">
        Page not found or has been moved.
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white dark:bg-slate-950 pb-32">
      {/* Cover Image Banner */}
      {page.cover_image && (
        <div className="relative w-full h-52 group overflow-hidden">
          <img
            src={page.cover_image}
            alt="Page cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
            <PageCoverPicker
              currentCover={page.cover_image}
              onSelectCover={handleCoverChange}
            />
          </div>
        </div>
      )}

      {/* Main Document Body */}
      <div className="max-w-3xl mx-auto px-8 md:px-12 pt-8">
        {/* Cover Controls when no cover is present */}
        {!page.cover_image && (
          <div className="mb-2 opacity-0 hover:opacity-100 transition-opacity">
            <PageCoverPicker
              currentCover={null}
              onSelectCover={handleCoverChange}
            />
          </div>
        )}

        {/* Page Icon */}
        <div className="mb-2">
          <PageIconPicker
            currentIcon={page.icon}
            onSelectIcon={handleIconChange}
          />
        </div>

        {/* Page Title Input */}
        <div className="mb-6">
          <textarea
            ref={titleInputRef}
            rows={1}
            value={page.title}
            onChange={handleTitleChange}
            placeholder="Untitled"
            className="w-full text-4xl font-bold tracking-tight text-slate-900 dark:text-white bg-transparent outline-none resize-none placeholder:text-slate-300 dark:placeholder:text-slate-700 leading-tight"
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
        </div>

        {/* Block Editor Core Canvas */}
        <BlockEditor page={page} initialBlocks={blocks} />
      </div>
    </div>
  );
}
