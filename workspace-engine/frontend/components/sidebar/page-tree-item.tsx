"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageTreeNode } from "@/types/page";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { apiClient } from "@/lib/api-client";
import {
  ChevronRight,
  Plus,
  MoreHorizontal,
  Star,
  Trash2,
  FileText,
} from "lucide-react";

interface PageTreeItemProps {
  node: PageTreeNode;
  depth?: number;
}

export function PageTreeItem({ node, depth = 0 }: PageTreeItemProps) {
  const params = useParams();
  const router = useRouter();
  const activePageId = params?.pageId as string;
  const workspaceSlug = params?.workspaceSlug as string;

  const {
    expandedPageIds,
    togglePageExpanded,
    addPageToTree,
    updatePageInTree,
    removePageFromTree,
  } = useWorkspaceStore();

  const isExpanded = expandedPageIds.includes(node.id);
  const isActive = activePageId === node.id;
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAddChildPage = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const newPage = await apiClient.createPage({
        workspace_id: node.workspace_id,
        parent_id: node.id,
        title: "Untitled",
        icon: "📄",
      });

      addPageToTree(node.id, {
        id: newPage.id,
        workspace_id: newPage.workspace_id,
        parent_id: newPage.parent_id,
        title: newPage.title,
        icon: newPage.icon,
        is_favorite: newPage.is_favorite,
        is_archived: newPage.is_archived,
        sort_order: newPage.sort_order,
        children: [],
      });

      router.push(`/${workspaceSlug}/${newPage.id}`);
    } catch (err) {
      console.error("Failed to add child page:", err);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const nextFav = !node.is_favorite;
      await apiClient.updatePage(node.id, { is_favorite: nextFav });
      updatePageInTree(node.id, { is_favorite: nextFav });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleDeletePage = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete "${node.title || "Untitled"}"?`)) {
      try {
        await apiClient.deletePage(node.id);
        removePageFromTree(node.id);
        if (isActive) {
          router.push(`/${workspaceSlug}`);
        }
      } catch (err) {
        console.error("Failed to delete page:", err);
      }
    }
  };

  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`group flex items-center justify-between py-1 pr-2 rounded-md cursor-pointer transition-colors text-xs font-medium ${
          isActive
            ? "bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white"
            : "hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Expand/Collapse Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              togglePageExpanded(node.id);
            }}
            className={`p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 text-slate-400 transition-transform ${
              node.children.length === 0 ? "invisible" : ""
            }`}
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
          </button>

          {/* Page Link */}
          <Link
            href={`/${workspaceSlug}/${node.id}`}
            className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden"
          >
            <span className="text-sm select-none">{node.icon || "📄"}</span>
            <span className="truncate">{node.title || "Untitled"}</span>
          </Link>
        </div>

        {/* Action Controls on Hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Add Child Page Button (+) */}
          <button
            type="button"
            onClick={handleAddChildPage}
            title="Add a page inside"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Favorite */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            title={node.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
            className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
              node.is_favorite
                ? "text-amber-500 opacity-100"
                : "text-slate-400 hover:text-amber-500"
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${node.is_favorite ? "fill-amber-500" : ""}`} />
          </button>

          {/* Delete Page */}
          <button
            type="button"
            onClick={handleDeletePage}
            title="Delete page"
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/50 text-slate-400 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recursive Sub-Page Children */}
      {isExpanded && node.children.length > 0 && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <PageTreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
