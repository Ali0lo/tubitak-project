"use client";

import React, { useState } from "react";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { PresenceBar } from "./presence-bar";
import { ShareModal } from "./share-modal";
import { useEditorStore } from "@/stores/editor-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { apiClient } from "@/lib/api-client";
import { Star, Share2, Check, Cloud } from "lucide-react";

export function Topbar() {
  const [shareOpen, setShareOpen] = useState(false);
  const { isSaving, activePage } = useEditorStore();
  const { updatePageInTree } = useWorkspaceStore();

  const handleToggleFavorite = async () => {
    if (!activePage) return;
    const nextFav = !activePage.is_favorite;
    try {
      await apiClient.updatePage(activePage.id, { is_favorite: nextFav });
      updatePageInTree(activePage.id, { is_favorite: nextFav });
      useEditorStore.getState().setActivePage({ ...activePage, is_favorite: nextFav });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  return (
    <>
      <header className="h-11 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 flex items-center justify-between select-none sticky top-0 z-20">
        {/* Left: Hierarchical Breadcrumbs */}
        <div className="flex items-center min-w-0">
          <BreadcrumbNav />
        </div>

        {/* Right: Presence, Status, Favorite & Share */}
        <div className="flex items-center gap-2">
          {/* Cloud Auto-Saving State Indicator */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mr-2">
            {isSaving ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span className="text-amber-500">Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Saved</span>
              </>
            )}
          </div>

          {/* Multiplayer Presence Avatars */}
          <PresenceBar />

          {/* Favorite Toggle Button */}
          {activePage && (
            <button
              type="button"
              onClick={handleToggleFavorite}
              title={activePage.is_favorite ? "Favorited" : "Add to favorites"}
              className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                activePage.is_favorite
                  ? "text-amber-500"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <Star
                className={`w-4 h-4 ${
                  activePage.is_favorite ? "fill-amber-500" : ""
                }`}
              />
            </button>
          )}

          {/* Share Button */}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        pageTitle={activePage?.title || "Untitled"}
      />
    </>
  );
}
