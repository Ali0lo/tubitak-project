"use client";

import React from "react";
import { PageTreeNode } from "@/types/page";
import { PageTreeItem } from "./page-tree-item";
import { Star, Plus } from "lucide-react";

interface PageTreeProps {
  tree: PageTreeNode[];
  onAddRootPage: () => void;
}

export function PageTree({ tree, onAddRootPage }: PageTreeProps) {
  // Collect all favorite pages recursively
  const favorites: PageTreeNode[] = [];
  function collectFavorites(nodes: PageTreeNode[]) {
    for (const node of nodes) {
      if (node.is_favorite) {
        favorites.push(node);
      }
      if (node.children.length > 0) {
        collectFavorites(node.children);
      }
    }
  }
  collectFavorites(tree);

  return (
    <div className="space-y-4">
      {/* Favorites Section */}
      {favorites.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>Favorites</span>
          </div>
          <div className="space-y-0.5">
            {favorites.map((fav) => (
              <PageTreeItem key={`fav-${fav.id}`} node={fav} depth={0} />
            ))}
          </div>
        </div>
      )}

      {/* Workspace Pages Section */}
      <div>
        <div className="flex items-center justify-between px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 group">
          <span>Pages</span>
          <button
            type="button"
            onClick={onAddRootPage}
            title="Add a page"
            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {tree.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-400 italic">
            No pages yet. Click + to create one.
          </div>
        ) : (
          <div className="space-y-0.5">
            {tree.map((node) => (
              <PageTreeItem key={node.id} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
